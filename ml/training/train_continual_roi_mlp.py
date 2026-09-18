#!/usr/bin/env python3
"""Train a continual tongue-ROI shadow candidate.

Inputs:
- immutable continual snapshot export (JSONL) containing adjudicated, verified-clinician labels;
- silver textbook replay dataset;
- current bootstrap model JSON.

Safety:
- prospective gold-holdout groups (group_hash mod 5 == 0) are rejected;
- outputs are shadow candidates only;
- metrics are internal continual-training agreement, never clinical accuracy;
- this script cannot promote or mutate production serving.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import random
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn

SEED = 20260918
FEATURE_ORDER = ["r","g","b","s","v","sin_h","cos_h","x","y","radial","red_bias","lightness"]

class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(12,24), nn.ReLU(),
            nn.Linear(24,12), nn.ReLU(),
            nn.Linear(12,1)
        )
    def forward(self,x):
        return self.net(x).squeeze(-1)

def rgb_features(bgr):
    rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB).astype(np.float32)/255.0
    hsv=cv2.cvtColor((rgb*255).astype(np.uint8),cv2.COLOR_RGB2HSV).astype(np.float32)
    h=(hsv[...,0]*2.0)*math.pi/180.0
    s=hsv[...,1]/255.0
    v=hsv[...,2]/255.0
    height,width=rgb.shape[:2]
    yy,xx=np.mgrid[0:height,0:width].astype(np.float32)
    x=(xx/max(1,width-1)-.5)*2
    y=(yy/max(1,height-1)-.5)*2
    radial=np.sqrt(x*x+y*y)/math.sqrt(2)
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    return np.stack([r,g,b,s,v,np.sin(h),np.cos(h),x,y,radial,r-(g+b)/2,.299*r+.587*g+.114*b],axis=-1).astype(np.float32)

def decode_data_url(value):
    raw=str(value or "")
    if "," in raw:
        raw=raw.split(",",1)[1]
    buf=np.frombuffer(base64.b64decode(raw),np.uint8)
    image=cv2.imdecode(buf,cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("invalid clinical image payload")
    return cv2.resize(image,(160,160),interpolation=cv2.INTER_AREA)

def decode_rle(rle):
    out=np.zeros(160*160,dtype=np.uint8)
    if not rle:
        return out.reshape(160,160)
    if rle.get("size") != [160,160]:
        raise ValueError("clinical ROI mask must be 160x160")
    index=0
    value=0
    for raw_n in rle.get("counts",[]):
        n=int(raw_n)
        if n<0 or index+n>out.size:
            raise ValueError("invalid RLE counts")
        if value:
            out[index:index+n]=1
        index+=n
        value=1-value
    if index != out.size:
        raise ValueError("RLE pixel count mismatch")
    return out.reshape(160,160)

def group_bucket(group_hash,modulus):
    return int(str(group_hash)[:8],16)%modulus

def load_clinical_rows(path):
    rows=[]
    with Path(path).open("r",encoding="utf-8") as fh:
        for line in fh:
            line=line.strip()
            if not line:
                continue
            row=json.loads(line)
            group=row.get("group_hash","")
            if len(group)!=64:
                raise ValueError("group_hash missing or invalid")
            if group_bucket(group,5)==0:
                raise RuntimeError("PROSPECTIVE_GOLD_HOLDOUT_LEAKAGE_BLOCKED")
            ann=row.get("annotation") or {}
            if ann.get("image_quality")!="usable":
                continue
            top=(row.get("inputs") or {}).get("top_data_url")
            if not top:
                raise ValueError("snapshot export must include top_data_url")
            image=decode_data_url(top)
            present=bool(ann.get("tongue_present"))
            mask=decode_rle(ann.get("roi_mask_rle")) if present else np.zeros((160,160),dtype=np.uint8)
            rows.append({
                "id":str(row.get("sample_id")),
                "group_hash":group,
                "split":str(row.get("split")),
                "image":image,
                "mask":mask.astype(np.float32),
            })
    if not rows:
        raise RuntimeError("NO_CONTINUAL_SUPERVISED_ROWS")
    return rows

def load_silver(root):
    root=Path(root)
    rows=json.loads((root/"manifest.json").read_text(encoding="utf-8"))
    return root,rows

def load_silver_row(root,row):
    image=cv2.imread(str(root/row["image_path"]),cv2.IMREAD_COLOR)
    mask=cv2.imread(str(root/row["mask_path"]),cv2.IMREAD_GRAYSCALE)
    if image is None or mask is None:
        raise ValueError(f"invalid silver sample {row.get('id')}")
    image=cv2.resize(image,(160,160),interpolation=cv2.INTER_AREA)
    mask=(cv2.resize(mask,(160,160),interpolation=cv2.INTER_NEAREST)>127).astype(np.float32)
    return image,mask

def sample_pixels(image,mask,n=768):
    feats=rgb_features(image).reshape(-1,12)
    labels=mask.reshape(-1)
    pos=np.flatnonzero(labels>.5)
    neg=np.flatnonzero(labels<=.5)
    if len(pos):
        pos_n=min(n//2,len(pos))
        neg_n=n-pos_n
        chosen=np.concatenate([
            np.random.choice(pos,pos_n,replace=len(pos)<pos_n),
            np.random.choice(neg,neg_n,replace=len(neg)<neg_n),
        ])
    else:
        chosen=np.random.choice(neg,min(n,len(neg)),replace=False)
    np.random.shuffle(chosen)
    return feats[chosen],labels[chosen]

def largest(mask):
    count,labels,stats,_=cv2.connectedComponentsWithStats(mask.astype(np.uint8),8)
    if count<=1:
        return mask.astype(np.uint8)
    idx=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
    return (labels==idx).astype(np.uint8)

def evaluate(model,rows,threshold):
    dice=[]
    iou=[]
    presence=[]
    for row in rows:
        image,gt=row["image"],(row["mask"]>.5).astype(np.uint8)
        feats=rgb_features(image).reshape(-1,12)
        with torch.no_grad():
            probs=torch.sigmoid(model(torch.from_numpy(feats))).numpy().reshape(160,160)
        pred=largest(probs>=threshold)
        inter=int((pred & gt).sum())
        ps=int(pred.sum())
        gs=int(gt.sum())
        union=ps+gs-inter
        dice.append((2*inter)/(ps+gs) if ps+gs else 1.0)
        iou.append(inter/union if union else 1.0)
        minimum=int(.018*pred.size)
        presence.append((ps>=minimum)==(gs>=minimum))
    if not rows:
        return {"n":0,"meanDice":None,"meanIoU":None,"presenceAgreement":None}
    return {
        "n":len(rows),
        "meanDice":float(np.mean(dice)),
        "meanIoU":float(np.mean(iou)),
        "presenceAgreement":float(np.mean(presence)),
    }

def load_baseline(model_path):
    artifact=json.loads(Path(model_path).read_text(encoding="utf-8"))
    if artifact.get("schemaVersion")!="aitc-pixel-mlp-v1":
        raise ValueError("baseline model schema mismatch")
    model=MLP()
    state=model.state_dict()
    for key in state:
        if key not in artifact.get("weights",{}):
            raise ValueError(f"baseline weight missing: {key}")
        state[key]=torch.tensor(artifact["weights"][key],dtype=state[key].dtype)
    model.load_state_dict(state)
    return artifact,model

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--baseline-model",required=True)
    ap.add_argument("--silver-root",required=True)
    ap.add_argument("--clinical-jsonl",required=True)
    ap.add_argument("--snapshot-version",required=True)
    ap.add_argument("--out-model",required=True)
    ap.add_argument("--out-checkpoint",required=True)
    ap.add_argument("--out-metrics",required=True)
    ap.add_argument("--epochs",type=int,default=6)
    ap.add_argument("--replay-multiplier",type=int,default=4)
    args=ap.parse_args()

    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    baseline,model=load_baseline(args.baseline_model)
    clinical=load_clinical_rows(args.clinical_jsonl)
    train_clin=[r for r in clinical if r["split"]=="train"]
    val_clin=[r for r in clinical if r["split"]=="validation"]
    if not train_clin:
        raise RuntimeError("NO_CONTINUAL_TRAIN_ROWS")

    silver_root,silver_rows=load_silver(args.silver_root)
    silver_train=[r for r in silver_rows if r.get("split")=="train"]
    if not silver_train:
        raise RuntimeError("SILVER_REPLAY_EMPTY")

    xs=[]
    ys=[]
    for row in train_clin:
        # Give adjudicated clinical rows higher sampling weight than replay rows.
        for _ in range(4):
            x,y=sample_pixels(row["image"],row["mask"],1024)
            xs.append(x);ys.append(y)

    replay_count=min(len(silver_train),max(16,len(train_clin)*max(1,args.replay_multiplier)))
    replay=random.sample(silver_train,replay_count) if replay_count<len(silver_train) else silver_train
    for row in replay:
        image,mask=load_silver_row(silver_root,row)
        x,y=sample_pixels(image,mask,512)
        xs.append(x);ys.append(y)

    X=np.concatenate(xs)
    Y=np.concatenate(ys)
    perm=np.random.permutation(len(Y))
    X=X[perm]
    Y=Y[perm]

    positive=float(Y.sum())
    negative=float(len(Y)-positive)
    loss_fn=nn.BCEWithLogitsLoss(pos_weight=torch.tensor([negative/max(1,positive)],dtype=torch.float32))
    optimizer=torch.optim.Adam(model.parameters(),lr=.001,weight_decay=1e-5)
    xt=torch.from_numpy(X)
    yt=torch.from_numpy(Y)

    for _ in range(max(1,args.epochs)):
        model.train()
        order=torch.randperm(len(yt))
        for start in range(0,len(yt),8192):
            idx=order[start:start+8192]
            loss=loss_fn(model(xt[idx]),yt[idx])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

    baseline_threshold=float(baseline.get("threshold",.8))
    threshold=baseline_threshold
    if val_clin:
        best=None
        for candidate in np.arange(.30,.91,.05):
            metric=evaluate(model,val_clin,float(candidate))
            score=-1 if metric["meanDice"] is None else metric["meanDice"]
            if best is None or score>best[0]:
                best=(score,float(candidate),metric)
        threshold=best[1]

    train_internal=evaluate(model,train_clin,threshold)
    val_internal=evaluate(model,val_clin,threshold)
    snapshot=args.snapshot_version
    model_id="aitc-tongue-roi-"+snapshot

    artifact={
        "schemaVersion":"aitc-pixel-mlp-v1",
        "modelId":model_id,
        "task":"tongue-roi",
        "inputSize":160,
        "featureOrder":FEATURE_ORDER,
        "architecture":[12,24,12,1],
        "activations":["relu","relu","sigmoid"],
        "threshold":threshold,
        "postprocess":{"largestComponent":True,"minPresenceCoverage":.018},
        "activation":"shadow-only",
        "training":{
            "seed":SEED,
            "strategy":"replay-finetune-v1",
            "snapshotVersion":snapshot,
            "goldSourcePolicy":"verified-clinical-contributions-only",
            "labelSource":"independent-adjudication",
            "prospectiveGoldHoldoutExcluded":True,
            "silverReplayDataset":"silver-textbook-teacher-v1",
            "silverReplayRows":replay_count,
            "clinicalTrainRows":len(train_clin),
            "clinicalValidationRows":len(val_clin),
            "epochs":max(1,args.epochs),
        },
        "weights":{k:v.detach().cpu().numpy().tolist() for k,v in model.state_dict().items()},
    }

    out_model=Path(args.out_model)
    out_model.write_text(json.dumps(artifact,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    out_checkpoint=Path(args.out_checkpoint)
    torch.save({
        "state_dict":model.state_dict(),
        "threshold":threshold,
        "snapshot_version":snapshot,
        "seed":SEED,
        "activation":"shadow-only",
    },out_checkpoint)

    metrics={
        "schemaVersion":"aitc-continual-training-metrics-v1",
        "metricSemantics":"internal agreement on continual-training train/validation rows only; NOT locked gold-holdout clinical accuracy",
        "snapshotVersion":snapshot,
        "trainInternalAgreement":train_internal,
        "validationInternalAgreement":val_internal,
        "prospectiveGoldHoldoutExcluded":True,
        "silverReplayDataset":"silver-textbook-teacher-v1",
        "promotionDecision":"none",
        "productionActivation":"none",
        "modelJsonSha256":hashlib.sha256(out_model.read_bytes()).hexdigest(),
        "trainingCheckpointSha256":hashlib.sha256(out_checkpoint.read_bytes()).hexdigest(),
    }
    Path(args.out_metrics).write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(metrics,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()

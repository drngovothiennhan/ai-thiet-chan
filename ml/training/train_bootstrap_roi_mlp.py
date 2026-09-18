#!/usr/bin/env python3
"""Train the Stage-2 bootstrap tongue ROI candidate.

The labels consumed here are weak bootstrap masks, not clinician gold. All
reported scores are agreement with those masks and must not be called clinical
accuracy, sensitivity or specificity.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn

SEED=20260917
FEATURE_ORDER=["r","g","b","s","v","sin_h","cos_h","x","y","radial","red_bias","lightness"]

def rgb_features(bgr):
    rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB).astype(np.float32)/255.0
    hsv=cv2.cvtColor((rgb*255).astype(np.uint8),cv2.COLOR_RGB2HSV).astype(np.float32)
    h=(hsv[...,0]*2.0)*math.pi/180.0;s=hsv[...,1]/255.0;v=hsv[...,2]/255.0
    height,width=rgb.shape[:2];yy,xx=np.mgrid[0:height,0:width].astype(np.float32)
    x=(xx/max(1,width-1)-.5)*2;y=(yy/max(1,height-1)-.5)*2
    radial=np.sqrt(x*x+y*y)/math.sqrt(2)
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    return np.stack([r,g,b,s,v,np.sin(h),np.cos(h),x,y,radial,r-(g+b)/2,.299*r+.587*g+.114*b],axis=-1).astype(np.float32)

class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net=nn.Sequential(nn.Linear(12,24),nn.ReLU(),nn.Linear(24,12),nn.ReLU(),nn.Linear(12,1))
    def forward(self,x):return self.net(x).squeeze(-1)

def load_row(root,row):
    image=cv2.imread(str(root/row["image_path"]),cv2.IMREAD_COLOR)
    mask=(cv2.imread(str(root/row["mask_path"]),cv2.IMREAD_GRAYSCALE)>127).astype(np.float32)
    if image is None or mask is None:raise ValueError(f"invalid sample {row['id']}")
    return image,mask

def sample_row(root,row,n=768):
    image,mask=load_row(root,row);features=rgb_features(image).reshape(-1,12);labels=mask.reshape(-1)
    pos=np.flatnonzero(labels>.5);neg=np.flatnonzero(labels<=.5)
    if len(pos):
        pos_n=min(n//2,len(pos));neg_n=n-pos_n
        chosen=np.concatenate([
            np.random.choice(pos,pos_n,replace=len(pos)<pos_n),
            np.random.choice(neg,neg_n,replace=len(neg)<neg_n)
        ])
        np.random.shuffle(chosen)
    else:
        chosen=np.random.choice(neg,min(n,len(neg)),replace=False)
    return features[chosen],labels[chosen]

def largest(mask):
    count,labels,stats,_=cv2.connectedComponentsWithStats(mask.astype(np.uint8),8)
    if count<=1:return mask.astype(np.uint8)
    idx=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
    return (labels==idx).astype(np.uint8)

def probabilities(model,root,row):
    image,mask=load_row(root,row)
    features=rgb_features(image).reshape(-1,12)
    with torch.no_grad():
        probs=torch.sigmoid(model(torch.from_numpy(features))).numpy().reshape(mask.shape)
    return probs,mask

def evaluate(model,root,rows,threshold):
    dice=[];iou=[];presence=[]
    for row in rows:
        probs,mask=probabilities(model,root,row)
        pred=largest(probs>=threshold);gt=(mask>.5).astype(np.uint8)
        intersection=int((pred&gt).sum());pred_sum=int(pred.sum());gt_sum=int(gt.sum());union=pred_sum+gt_sum-intersection
        dice.append((2*intersection)/(pred_sum+gt_sum) if pred_sum+gt_sum else 1.0)
        iou.append(intersection/union if union else 1.0)
        minimum=int(.018*pred.size)
        presence.append((pred_sum>=minimum)==(gt_sum>=minimum))
    return {"meanDice":float(np.mean(dice)),"meanIoU":float(np.mean(iou)),"presenceAgreement":float(np.mean(presence)),"n":len(rows)}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--dataset-root",required=True)
    p.add_argument("--manifest",default="manifest.json")
    p.add_argument("--out-model",required=True)
    p.add_argument("--out-checkpoint",required=True)
    p.add_argument("--out-metrics",required=True)
    args=p.parse_args()
    root=Path(args.dataset_root)
    rows=json.loads((root/args.manifest).read_text(encoding="utf-8"))
    random.seed(SEED);np.random.seed(SEED);torch.manual_seed(SEED)

    train=[r for r in rows if r["split"]=="train"]
    xs=[];ys=[]
    for row in train:
        x,y=sample_row(root,row);xs.append(x);ys.append(y)
    X=np.concatenate(xs);Y=np.concatenate(ys);perm=np.random.permutation(len(Y));X=X[perm];Y=Y[perm]

    model=MLP();positive=float(Y.sum());negative=float(len(Y)-positive)
    loss_fn=nn.BCEWithLogitsLoss(pos_weight=torch.tensor([negative/max(1,positive)],dtype=torch.float32))
    optimizer=torch.optim.Adam(model.parameters(),lr=.004,weight_decay=1e-5)
    xt=torch.from_numpy(X);yt=torch.from_numpy(Y)
    for _ in range(18):
        order=torch.randperm(len(yt));model.train()
        for start in range(0,len(yt),8192):
            idx=order[start:start+8192];loss=loss_fn(model(xt[idx]),yt[idx])
            optimizer.zero_grad();loss.backward();optimizer.step()

    validation=[r for r in rows if r["split"]=="validation"]
    best=None
    for threshold in np.arange(.20,.81,.05):
        result=evaluate(model,root,validation,float(threshold))
        if best is None or result["meanDice"]>best[0]:best=(result["meanDice"],float(threshold),result)
    threshold=best[1]
    test=[r for r in rows if r["split"]=="test"]
    test_result=evaluate(model,root,test,threshold)
    at1_result=evaluate(model,root,[r for r in test if r["source"]=="AT1"],threshold)

    state=model.state_dict()
    artifact={
        "schemaVersion":"aitc-pixel-mlp-v1","modelId":"aitc-tongue-roi-mlp-bootstrap-v1","task":"tongue-roi",
        "inputSize":160,"featureOrder":FEATURE_ORDER,"architecture":[12,24,12,1],"activations":["relu","relu","sigmoid"],
        "threshold":threshold,"postprocess":{"largestComponent":True,"minPresenceCoverage":.018},
        "training":{"seed":SEED,"dataset":"aitc-stage2-bootstrap-479-v1","labelPolicy":"weak-supervision: runtime-mask-v2 + source-role negatives; NOT clinician gold","epochs":18,"sampledPixels":int(len(Y))},
        "weights":{k:v.detach().cpu().numpy().tolist() for k,v in state.items()}
    }
    model_path=Path(args.out_model)
    model_path.write_text(json.dumps(artifact,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    checkpoint=Path(args.out_checkpoint)
    torch.save({"state_dict":state,"threshold":threshold,"feature_order":FEATURE_ORDER,"architecture":[12,24,12,1],"seed":SEED},checkpoint)

    metrics={
        "schemaVersion":"aitc-bootstrap-metrics-v1",
        "metricSemantics":"agreement with weak bootstrap masks; NOT clinical accuracy and NOT production approval",
        "validationThresholdSelection":{"threshold":threshold,**best[2]},
        "testWeakLabelAgreement":test_result,
        "externalAT1WeakLabelAgreement":at1_result,
        "clinicalAccuracyPublished":False,"goldHoldoutAvailable":False,"productionApproval":False,
        "modelJsonSha256":hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "trainingCheckpointSha256":hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    }
    Path(args.out_metrics).write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(metrics,ensure_ascii=False,indent=2))

if __name__=="__main__":main()

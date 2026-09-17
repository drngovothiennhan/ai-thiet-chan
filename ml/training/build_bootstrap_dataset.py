#!/usr/bin/env python3
"""Build the Stage-2 weak-supervision bootstrap dataset.

This script intentionally creates engineering bootstrap labels only. It does not
create clinician gold labels and must never be used to claim clinical accuracy.
Raw images stay outside Git; only manifests/metrics are committed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import fitz
import numpy as np

SOURCE_IDS=("TC1","DY1","MC1","AT1")

def rgb_to_hsv_arr(rgb):
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    return hsv[...,0].astype(np.float32)*2,hsv[...,1].astype(np.float32)/255,hsv[...,2].astype(np.float32)/255

def largest_component(mask):
    count,labels,stats,_=cv2.connectedComponentsWithStats(mask.astype(np.uint8),8)
    if count<=1:return mask.astype(bool),int(mask.sum())
    idx=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
    out=labels==idx
    return out,int(out.sum())

def runtime_mask(rgb,relaxed=False):
    h0,w0=rgb.shape[:2]
    scale=min(1.0,192/max(h0,w0))
    w=max(48,round(w0*scale));h=max(48,round(h0*scale))
    sm=cv2.resize(rgb,(w,h),interpolation=cv2.INTER_AREA)
    r=sm[...,0].astype(np.float32);g=sm[...,1].astype(np.float32);b=sm[...,2].astype(np.float32)
    H,S,V=rgb_to_hsv_arr(sm);yy,xx=np.mgrid[0:h,0:w]
    red_bias=r-(g+b)/2;tongue_hue=(H<=62)|(H>=296)
    if relaxed:
        mask=(np.abs(xx-w*.5)<=w*.36)&(yy>=h*.12)&(yy<=h*.94)&(r>50)&(V>.18)&(S>.045)&tongue_hue&(red_bias>1.5)&(r>=g*1.01)&(r>=b*.93)
    else:
        mask=(xx>=w*.08)&(xx<=w*.92)&(yy>=h*.05)&(yy<=h*.97)&(r>55)&(V>.20)&(S>.08)&tongue_hue&(red_bias>3)
    comp,area=largest_component(mask);minimum=max(120,w*h*.018)
    if area<minimum and not relaxed:return runtime_mask(rgb,True)
    return comp,area

def dhash(rgb,size=16):
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    sm=cv2.resize(gray,(size+1,size),interpolation=cv2.INTER_AREA)
    bits=(sm[:,1:]>sm[:,:-1]).reshape(-1)
    value=0;out=[]
    for i,bit in enumerate(bits):
        value=(value<<1)|int(bit)
        if i%4==3:out.append(format(value,"x"));value=0
    return "".join(out)

def hamming_hex(a,b):
    return sum((int(x,16)^int(y,16)).bit_count() for x,y in zip(a,b))

def extract_source(pdf_path,source_id,out):
    rows=[];doc=fitz.open(pdf_path);seen=set()
    for page_index,page in enumerate(doc):
        for item in page.get_images(full=True):
            xref=item[0]
            if xref in seen:continue
            seen.add(xref)
            raw=doc.extract_image(xref)["image"]
            bgr=cv2.imdecode(np.frombuffer(raw,np.uint8),cv2.IMREAD_COLOR)
            if bgr is None:continue
            rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB)
            mask,area=runtime_mask(rgb)
            mh,mw=mask.shape;positive=bool(area>=max(120,mw*mh*.018))
            row_id=f"{source_id}-p{page_index+1:03d}-x{xref}"
            image160=cv2.resize(rgb,(160,160),interpolation=cv2.INTER_AREA)
            mask160=cv2.resize(mask.astype(np.uint8),(160,160),interpolation=cv2.INTER_NEAREST)
            cv2.imwrite(str(out/"images"/f"{row_id}.jpg"),cv2.cvtColor(image160,cv2.COLOR_RGB2BGR),[cv2.IMWRITE_JPEG_QUALITY,92])
            cv2.imwrite(str(out/"masks"/f"{row_id}.png"),mask160*255)
            rows.append({
                "id":row_id,"source":source_id,"page":page_index+1,"xref":xref,
                "sha256":hashlib.sha256(raw).hexdigest(),"width":int(rgb.shape[1]),"height":int(rgb.shape[0]),
                "pseudo_positive":positive,"dhash":dhash(rgb),
                "image_path":f"images/{row_id}.jpg","mask_path":f"masks/{row_id}.png"
            })
    return rows

def assign_splits(rows):
    parent=list(range(len(rows)))
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    def union(a,b):
        ra,rb=find(a),find(b)
        if ra!=rb:parent[rb]=ra

    exact={};pages={};bins={}
    for i,row in enumerate(rows):
        if row["sha256"] in exact:union(i,exact[row["sha256"]])
        else:exact[row["sha256"]]=i
        key=(row["source"],row["page"])
        if key in pages:union(i,pages[key])
        else:pages[key]=i
        ar=round(row["width"]/max(1,row["height"]),1)
        bins.setdefault(ar,[]).append(i)

    for ids in bins.values():
        for a in range(len(ids)):
            for b in range(a+1,len(ids)):
                if hamming_hex(rows[ids[a]]["dhash"],rows[ids[b]]["dhash"])<=8:
                    union(ids[a],ids[b])

    roots={};groups={}
    for i,row in enumerate(rows):
        root=find(i)
        gid=roots.setdefault(root,f"g{len(roots):04d}")
        row["group_id"]=gid;groups.setdefault(gid,[]).append(row)

    for gid,items in groups.items():
        if any(x["source"]=="AT1" for x in items):
            split="test"
        else:
            bucket=int(hashlib.sha256(gid.encode()).hexdigest()[:8],16)%100
            split="train" if bucket<78 else "validation" if bucket<90 else "test"
        for row in items:row["split"]=split
    return groups

def audit(rows,groups):
    def block(split):
        xs=[r for r in rows if r["split"]==split]
        sources={}
        for r in xs:sources[r["source"]]=sources.get(r["source"],0)+1
        return {"n":len(xs),"positive":sum(r["pseudo_positive"] for r in xs),"negative":sum(not r["pseudo_positive"] for r in xs),"groups":len({r["group_id"] for r in xs}),"sources":sources}
    group_splits={}
    sha_splits={}
    for r in rows:
        group_splits.setdefault(r["group_id"],set()).add(r["split"])
        sha_splits.setdefault(r["sha256"],set()).add(r["split"])
    return {
        "train":block("train"),"validation":block("validation"),"test":block("test"),
        "total":{"n":len(rows),"positive":sum(r["pseudo_positive"] for r in rows),"negative":sum(not r["pseudo_positive"] for r in rows),"groups":len(groups)},
        "leakage":{
            "group_cross_split":sum(len(x)>1 for x in group_splits.values()),
            "exact_derived_sha_cross_split":sum(len(x)>1 for x in sha_splits.values()),
            "near_duplicate_hamming_threshold":8,
            "AT1_external_holdout":all(r["split"]=="test" for r in rows if r["source"]=="AT1")
        }
    }

def main():
    p=argparse.ArgumentParser()
    for sid in SOURCE_IDS:p.add_argument(f"--{sid.lower()}",required=True,help=f"path to {sid} source PDF")
    p.add_argument("--out",required=True)
    args=p.parse_args()
    out=Path(args.out);(out/"images").mkdir(parents=True,exist_ok=True);(out/"masks").mkdir(parents=True,exist_ok=True)
    rows=[]
    for sid in SOURCE_IDS:rows+=extract_source(Path(getattr(args,sid.lower())),sid,out)
    groups=assign_splits(rows);stats=audit(rows,groups)
    (out/"manifest.json").write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf-8")
    (out/"stats.json").write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(stats,ensure_ascii=False,indent=2))
    if stats["leakage"]["group_cross_split"] or stats["leakage"]["exact_derived_sha_cross_split"]:
        raise SystemExit("LEAKAGE_AUDIT_FAILED")

if __name__=="__main__":main()

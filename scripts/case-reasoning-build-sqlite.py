#!/usr/bin/env python3
import argparse, gzip, hashlib, json, os, sqlite3
from collections import Counter

def open_text(path):
    return gzip.open(path,'rt',encoding='utf-8') if path.endswith('.gz') else open(path,'r',encoding='utf-8')

def sha256_file(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

p=argparse.ArgumentParser()
p.add_argument('--input',action='append',required=True)
p.add_argument('--output',required=True)
p.add_argument('--manifest',required=True)
a=p.parse_args()
os.makedirs(os.path.dirname(a.output) or '.',exist_ok=True)
if os.path.exists(a.output): os.remove(a.output)
con=sqlite3.connect(a.output)
con.execute('PRAGMA journal_mode=OFF')
con.execute('PRAGMA synchronous=OFF')
con.execute('CREATE TABLE cases (id INTEGER PRIMARY KEY, corpus_id TEXT NOT NULL, source_id TEXT NOT NULL, source_record_id TEXT, task TEXT, case_text TEXT NOT NULL, target TEXT, provenance_json TEXT NOT NULL, content_sha256 TEXT NOT NULL UNIQUE, simhash64 TEXT, pmid TEXT, pmcid TEXT, doi TEXT, license TEXT)')
con.execute('CREATE INDEX idx_cases_source ON cases(source_id)')
con.execute('CREATE INDEX idx_cases_record ON cases(source_record_id)')
con.execute('CREATE VIRTUAL TABLE cases_fts USING fts5(case_text,target,source_id,task,content="cases",content_rowid="id",tokenize="unicode61")')
source_counts=Counter(); task_counts=Counter(); inserted=0; duplicates=0
for path in a.input:
    with open_text(path) as f:
        for line in f:
            line=line.strip()
            if not line: continue
            r=json.loads(line); prov=r.get('provenance') or {}; hashes=r.get('hashes') or {}
            values=(r.get('corpusId') or '',r.get('sourceId') or '',str(r.get('sourceRecordId') or ''),r.get('task') or '',r.get('caseText') or '',r.get('target') or '',json.dumps(prov,ensure_ascii=False,separators=(',',':')),hashes.get('contentSha256') or '',hashes.get('simhash64') or '',prov.get('pmid'),prov.get('pmcid'),prov.get('doi'),prov.get('license'))
            if not values[4] or not values[7]: continue
            cur=con.execute('INSERT OR IGNORE INTO cases(corpus_id,source_id,source_record_id,task,case_text,target,provenance_json,content_sha256,simhash64,pmid,pmcid,doi,license) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',values)
            if cur.rowcount:
                inserted+=1; source_counts[values[1]]+=1; task_counts[values[3]]+=1
            else: duplicates+=1
con.execute('INSERT INTO cases_fts(rowid,case_text,target,source_id,task) SELECT id,case_text,target,source_id,task FROM cases')
con.execute("INSERT INTO cases_fts(cases_fts) VALUES('optimize')")
con.commit()
probe=con.execute("SELECT count(*) FROM cases_fts WHERE cases_fts MATCH 'tongue OR syndrome OR diagnosis'").fetchone()[0]
con.close()
manifest={
  'schemaVersion':'aitc-case-retrieval-snapshot-v1',
  'corpusId':'AITC-LLM-Case-Reasoning-v1',
  'engine':'sqlite-fts5',
  'inputs':[{'path':x,'sha256':sha256_file(x)} for x in a.input],
  'records':inserted,'crossSourceDuplicatesSkipped':duplicates,
  'sourceCounts':dict(source_counts),'taskCounts':dict(task_counts),
  'probeMatchCount':probe,
  'database':os.path.basename(a.output),
  'databaseSha256':sha256_file(a.output),
  'clinicalGoldOperationalRequirement':False
}
os.makedirs(os.path.dirname(a.manifest) or '.',exist_ok=True)
with open(a.manifest,'w',encoding='utf-8') as f: json.dump(manifest,f,ensure_ascii=False,indent=2); f.write('\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))

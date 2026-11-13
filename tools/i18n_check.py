import json,sys,re
src=open(sys.argv[1],encoding='utf-8').read()
s=src[src.index('{',src.index('YS_I18N')):src.rstrip().rstrip(';').rindex('}')+1]
d=json.loads(s)
def walk(o,p=''):
    if isinstance(o,dict):
        for k,v in o.items(): yield from walk(v,f'{p}.{k}' if p else k)
    elif isinstance(o,list):
        for i,v in enumerate(o): yield from walk(v,f'{p}.{i}')
    else: yield p
ref=set(walk(d['en']))
ok=True
for l in d:
    ks=set(walk(d[l]))
    if ks!=ref: ok=False; print(l,'missing',sorted(ref-ks),'extra',sorted(ks-ref))
print('langs',list(d),'keys',len(ref),'OK' if ok else 'MISMATCH')

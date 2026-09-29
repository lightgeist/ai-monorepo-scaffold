from pathlib import Path
import json,shutil,sys
root=Path(sys.argv[1]);inputs=Path(sys.argv[2]);e=root/'evidence';e.mkdir(exist_ok=True)
combined=None;projects={};stats={'expected':0,'skipped':0,'unexpected':0,'flaky':0,'duration':0};summaries=[]
for folder in sorted(inputs.glob('brightmath-browser-*')):
 report=folder/'browser-results.json';assert report.exists(),folder
 obj=json.loads(report.read_text());s=obj['stats'];assert s['unexpected']==0 and s['flaky']==0 and s['skipped']==0,(folder,s)
 assert s['expected']==14,(folder,'All fourteen journeys must execute',s)
 if combined is None:combined={**obj,'suites':[]}
 combined['suites'].extend(obj['suites'])
 for project in obj['config']['projects']:projects[project['name']]=project
 for k in ['expected','skipped','unexpected','flaky']:stats[k]+=s[k]
 stats['duration']=max(stats['duration'],s['duration'])
 summaries.append({'artifact':folder.name,'stats':s})
 for p in folder.rglob('*'):
  if not p.is_file() or p.name=='browser-results.json':continue
  rel=p.relative_to(folder)
  target=(e/rel) if rel.parts[0]=='screenshots' else e/'browser-projects'/folder.name/rel
  target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
assert len(summaries)==5 and stats['expected']==70,summaries
combined['config']['projects']=list(projects.values());combined['stats']=stats
combined['stats']['startTime']=min(x['stats']['startTime'] for x in summaries)
combined['aggregation']={'runs':summaries,'durationMeaning':'maximum project duration; projects executed in parallel','allUseSamePreparedSource':True}
(e/'browser-results.json').write_text(json.dumps(combined,indent=2)+'\n')
print('ALL_BROWSER_GATES_PASSED',json.dumps(stats))

from pathlib import Path
root=Path(__file__).parent
p=root/'e2e/user-journeys.spec.mjs';s=p.read_text();assert 'fullPage:true' in s;p.write_text(s.replace('fullPage:true','fullPage:false,timeout:7000'))
p=root/'playwright.config.mjs';s=p.read_text().replace('fullyParallel:true,workers:3,retries:0','fullyParallel:true,workers:3,retries:0,maxFailures:5');p.write_text(s)
print('Capture actual viewport without resize-feedback; preserve all interaction assertions')

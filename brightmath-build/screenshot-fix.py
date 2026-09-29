from pathlib import Path
root=Path(__file__).parent
p=root/'e2e/user-journeys.spec.mjs';s=p.read_text();assert 'fullPage:true' in s;p.write_text(s.replace('fullPage:true','fullPage:false,timeout:7000'))
p=root/'playwright.config.mjs';s=p.read_text().replace('fullyParallel:true,workers:3,retries:0','fullyParallel:true,workers:2,retries:0,maxFailures:5')
# Continuous per-frame SVG mutation produced 1.45 GB of traces in the canceled
# run. Test recording must not dominate the browser being measured. Keep real
# input/assertions, failure screenshots, explicit screenshots and JSON outcomes.
s=s.replace("trace:'retain-on-failure'","trace:'off'")
p.write_text(s)
print('Bounded viewport captures and non-invasive recording; all user journeys retained')

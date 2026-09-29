import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',timeout:90000,expect:{timeout:12000},fullyParallel:true,workers:3,retries:0,
 outputDir:'evidence/browser-artifacts',reporter:[['list'],['json',{outputFile:'evidence/browser-results.json'}]],
 use:{baseURL:'http://127.0.0.1:4173',reducedMotion:'reduce',screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{command:'node server.mjs dist/site',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:15000},
 projects:[
  {name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1365,height:900}}},
  {name:'firefox-desktop',use:{browserName:'firefox',viewport:{width:1365,height:900}}},
  {name:'webkit-desktop',use:{browserName:'webkit',viewport:{width:1365,height:900}}},
  {name:'chromium-phone',use:{browserName:'chromium',viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2}},
  {name:'webkit-phone',use:{browserName:'webkit',viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2}}
 ]
});

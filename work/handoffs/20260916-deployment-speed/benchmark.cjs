'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {performance} = require('node:perf_hooks');
const base = __dirname;
const apps = [
  {name:'dashboard', repo:'repo', sha:'6cf74ff31fb3895874f4902e3d8055b357e24135'},
  {name:'svis', repo:'svis', sha:'7ce1404739b95748c114349a0e3982e6b31ded65'},
  {name:'ops', repo:'ops-panel', sha:'e888ae640b2b7fb6106f178c45fe20486c85fb66'},
];
const mode = process.argv[2];
if (!['baseline-first','baseline-warm','optimized-first','optimized-warm','optimized-safe-first','optimized-safe-warm'].includes(mode)) throw new Error('Invalid mode');
const benchRoot = path.join(base,'benchmarks');
fs.mkdirSync(benchRoot,{recursive:true});
const chosen = process.argv[3] ? apps.filter(app=>app.name===process.argv[3]) : apps;
for (const app of chosen) {
  const id = app.name+'-'+mode;
  const root = path.join(benchRoot,id);
  const output = path.join(benchRoot,id+'-release');
  const reportFile = path.join(benchRoot,id+'.json');
  if (fs.existsSync(root) || fs.existsSync(reportFile)) throw new Error('Refusing to overwrite benchmark '+id);
  const checkout = spawnSync('C:/Program Files/Git/cmd/git.exe',['-C',path.join(base,app.repo),'worktree','add','--detach',root,app.sha],{encoding:'utf8',windowsHide:true});
  if(checkout.status!==0) throw new Error(checkout.stderr);
  // Match the existing worker's documented-template exclusion.
  for(const directory of [root,path.join(root,'web')]) {
    const template=path.join(directory,'.env.local.example');
    if(fs.existsSync(template)) fs.unlinkSync(template);
  }
  if(mode.startsWith('optimized')) {
    const files = ['hosting/build.cjs','hosting/build-cache.cjs'];
    if(app.name==='dashboard') files.push('package.json','package-lock.json','next.config.mjs');
    if(app.name==='svis' && fs.existsSync(path.join(base,app.repo,'hosting/runtime/package.json'))) {
      files.push('hosting/runtime/package.json','hosting/runtime/package-lock.json','host/build.cjs');
    }
    for(const name of files) {
      const destination=path.join(root,name);
      fs.mkdirSync(path.dirname(destination),{recursive:true});
      fs.copyFileSync(path.join(base,app.repo,name),destination);
    }
  }
  const config=path.join(base,'public-empty.json');
  fs.writeFileSync(config,'{}');
  const log=fs.openSync(path.join(benchRoot,id+'.log'),'a');
  const cache=path.join(benchRoot,'cache',app.name);
  fs.mkdirSync(path.join(cache,'npm'),{recursive:true});
  const phases=[];
  let status='passed', errorText='';
  const start=performance.now();
  console.log('Starting '+id+' at '+new Date().toISOString());
  try {
    const {build}=require(path.join(root,'hosting/build.cjs'));
    build(config,output,{
      root,
      cacheDirectory:mode.startsWith('optimized')?cache:undefined,
      spawnSync:(command,args,options)=>{
        const phaseStart=performance.now();
        const label=args.includes('ci')?'install':args.some(a=>/vitest|--test/.test(a))?'tests':args.includes('build')?'build':'host-build';
        const result=spawnSync(command,args,{
          ...options,
          env:{...options.env,NPM_CONFIG_CACHE:path.join(cache,'npm')},
          stdio:['ignore',log,log],
          windowsHide:true,
          timeout:240000,
        });
        const phase={label,cwd:path.relative(root,options.cwd),durationMs:Math.round(performance.now()-phaseStart),exitCode:result.status};
        phases.push(phase);
        fs.writeSync(log,'\n[benchmark-phase] '+JSON.stringify(phase)+'\n');
        console.log(id+': '+label+' '+(phase.durationMs/1000).toFixed(1)+'s, exit '+phase.exitCode);
        return result;
      }
    });
  } catch(error) { status='failed';errorText=error.message; }
  finally {
    fs.closeSync(log);
    const report={app:app.name,mode,sha:app.sha,node:process.version,identity:require('node:os').userInfo().username,status,error:errorText,totalMs:Math.round(performance.now()-start),phases,at:new Date().toISOString()};
    fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
    if (status !== 'passed') throw new Error('Benchmark failed; stop before the next app: ' + errorText);
  }
}

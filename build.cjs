const esbuild=require('esbuild'),path=require('path');
const common={bundle:true,minify:true,format:'iife',target:['es2022'],define:{'process.env.NODE_ENV':'"production"'},legalComments:'linked'};
esbuild.buildSync({...common,entryPoints:['src/main.tsx'],outfile:'assets/app.js',jsx:'automatic'});
esbuild.buildSync({...common,entryPoints:['src/AveragingPanel.tsx'],outfile:'assets/averaging-a.js',jsx:'transform',globalName:'AddPosition',alias:{react:path.resolve('src/a-react.ts')}});

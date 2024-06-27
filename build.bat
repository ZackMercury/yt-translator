del yt-translate.exe
call npx tsc ./index.ts --esModuleInterop
del index.js
call npx esbuild ./index.js --bundle --platform=node --outfile=./out.js
call node --experimental-sea-config sea-config.json
del out.js
call node -e "require('fs').copyFileSync(process.execPath, 'yt-translate.exe')" 
call npx postject yt-translate.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
del sea-prep.blob

echo "Build complete!"
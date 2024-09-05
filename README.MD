# Nexious Scritps

## Download

- npm
  - npm i -S nexious-scripts --save-dev
- Yarn:
  - yarn add nexious-scripts --save-dev

## Setting up TS its a starter guide

1. download typescript and associated types as dev dependency
2. create ts.config.json for ts linting

   - tsconfig.json

   ```text
       {
         "compilerOptions": {
           "target": "ES2022", // if code runs on the browser Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */,
           "module": "ES2020",
           "moduleResolution": "Node",
           "esModuleInterop": true /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */,
           "allowSyntheticDefaultImports": true, // e.i import package from 'library'
           "jsx": "react-jsx" /* Specify what JSX code is generated. */,
           "baseUrl": "src" /* Specify the base directory to resolve non-relative module names. */,
           "paths": {
             // "@context/*": ["src/utils/context/*"]
           } // Specify a set of entries that re-map imports to additional lookup locations. */,
           "forceConsistentCasingInFileNames": true,
           "declaration": true /* Generate .d.ts files from TypeScript and JavaScript files in your project. */,
           "sourceMap": true /* Create source map files for emitted JavaScript files. */,
           "outDir": "dist" /* Specify an output folder for all emitted files. */,
           "isolatedModules": true,
           "strict": true /* Enable all strict type-checking options. */,
           "lib": ["ES5", "ES2015", "ES2016", "DOM", "ESNext", "DOM.Iterable"],
           "declarationMap": true /* Create sourcemaps for d.ts files. */,
           "inlineSources": true /* Include source code in the sourcemaps inside the emitted JavaScript. */
         },
         "include": ["src/*"],
         "exclude": ["node_modules"]
       }

   ```

3. update index.html script tag to point to new ts file
   - old index.html = `<script type="module" src="/src/main.jsx"></script>`
   - new index.html = `<script type="module" src="/src/main.tsx"></script>`
4. update scripts in package.json file to include a watch file to watch for changes
   - add command `"watch": "tsc -p tsconfig.json -w"`
5. if you are adding typescript to an existing application dont rename files manually.
   - run terminal on root `cd node_modules/nexious-library && npm run renameFile src 'jsx' 'tsx'`
   - this command takes 3 required arguments:
     1. first is the path usually src
     2. second is the file extension of the files you want to rename probably 'jsx'
     3. third is the desired file extension name
   - this will run a shell script. that will:
     - rename all files to desired the extention name in the desired path

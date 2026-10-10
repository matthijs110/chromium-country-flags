const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

const input = path.resolve('src/options/options.css');
const output = path.resolve('dist/css/dist.css');

async function build() {
  // Compile once after webpack has cleaned and populated dist.
  const result = await postcss([tailwind({ optimize: { minify: true } })]).process(
    fs.readFileSync(input, 'utf8'),
    { from: input, to: output, map: false },
  );

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, result.css);
  console.log('Built options CSS');
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

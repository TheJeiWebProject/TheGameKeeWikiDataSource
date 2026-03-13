import fs from 'fs-extra';

const file = 'data/raw/武器图鉴/690864.json';

async function analyze() {
    const content = await fs.readJson(file);
    const data = JSON.parse(content.content_json);
    
    console.log(JSON.stringify(data, null, 2));
}

analyze();
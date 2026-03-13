
import fs from 'fs';

try {
    const content = fs.readFileSync('debug_loxi_state.js', 'utf8');
    const prefix = 'window.__INITIAL_STATE__ = ';
    
    let jsonStr = '';
    if (content.startsWith(prefix)) {
        jsonStr = content.substring(prefix.length);
    } else {
        const start = content.indexOf(prefix);
        if (start === -1) {
            throw new Error('Could not find window.__INITIAL_STATE__');
        }
        jsonStr = content.substring(start + prefix.length);
    }

    // Remove potential trailing semicolon or script tags if any
    // Since we know it's likely just the assignment in this debug file
    // But let's be safe and parse it.
    
    // In the debug file, it might just be the line.
    // Let's try to parse the whole thing first.
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        // If it fails, maybe there's a semicolon at the end
        if (jsonStr.trim().endsWith(';')) {
             jsonStr = jsonStr.trim().slice(0, -1);
             data = JSON.parse(jsonStr);
        } else {
            // Or maybe it's inside a larger HTML file and we need to find the matching brace
            // But the file provided seems to be just the line.
            throw e;
        }
    }

    // Extract the 'detail' component data
    const ssrData = data.ssrComponentData;
    const detailComponent = ssrData.find(c => c.componentName === 'detail');
    
    if (detailComponent) {
        // componentData is a stringified JSON
        const detailData = JSON.parse(detailComponent.componentData);
        
        // Check content_json
        if (detailData.detail && detailData.detail.content_json) {
            console.log('Found content_json, length:', detailData.detail.content_json.length);
            
            // Parse content_json if it's a string (it usually is in the API response, but let's check)
            let contentJson = detailData.detail.content_json;
            if (typeof contentJson === 'string') {
                 try {
                     contentJson = JSON.parse(contentJson);
                 } catch (e) {
                     console.error('Failed to parse content_json string');
                 }
            }
            
            detailData.detail.content_json = contentJson;
        }

        fs.writeFileSync('debug_loxi_state_parsed.json', JSON.stringify(detailData, null, 2));
        console.log('Successfully extracted state to debug_loxi_state_parsed.json');
    } else {
        console.error('Detail component not found in SSR data');
    }

} catch (error) {
    console.error('Error:', error.message);
}

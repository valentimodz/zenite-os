const fs = require('fs');

let content = fs.readFileSync('SUPABASE.sql', 'utf8');
const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/^\s*CREATE POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_\.]+)/);
  if (match) {
    const policyName = match[1];
    const tableName = match[2];
    const expectedDrop = `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};`;
    
    let hasDrop = false;
    if (i > 0 && lines[i-1].trim() === expectedDrop) hasDrop = true;
    if (i > 1 && lines[i-2].trim() === expectedDrop) hasDrop = true;
    if (i > 2 && lines[i-3].trim() === expectedDrop) hasDrop = true;
    
    if (!hasDrop) {
      newLines.push(expectedDrop);
    }
  }
  newLines.push(line);
}

fs.writeFileSync('SUPABASE.sql', newLines.join('\n'), 'utf8');
console.log('Fixed SUPABASE.sql safely!');

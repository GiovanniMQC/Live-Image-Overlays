const fs = require('fs');
let code = fs.readFileSync('public/admin.html', 'utf8');

code = code.replace(
    /if \(src && \(src\.startsWith\('http'\) \|\| src\.startsWith\('data:'\)\) && !src\.includes\('\/imgres\?'\)\) \{/g,
    'if (src && (src.startsWith(\'http\') || src.startsWith(\'data:\') || src.startsWith(\'/uploads/\')) && !src.includes(\'/imgres?\')) {'
);

code = code.replace(
    /let plain = dataTransfer\.getData\('text\/plain'\);\s+if \(plain && \(plain\.startsWith\('http'\) \|\| plain\.startsWith\('data:'\)\) && !plain\.includes\('\/imgres\?'\)\) \{/g,
    \`let plain = dataTransfer.getData('text/plain');
            if (plain && (plain.startsWith('http') || plain.startsWith('data:') || plain.startsWith('/uploads/')) && !plain.includes('/imgres?')) {\`
);

code = code.replace(
    /if \(url && \(url\.startsWith\('http'\) \|\| url\.startsWith\('data:'\)\)\) \{/g,
    'if (url && (url.startsWith(\'http\') || url.startsWith(\'data:\') || url.startsWith(\'/uploads/\'))) {'
);

fs.writeFileSync('public/admin.html', code);
console.log('admin.html patched 3.');

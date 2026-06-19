// Merge all module JSON files into course.json
const fs = require('fs');
const path = require('path');

const courseFile = path.join(__dirname, 'course.json');
const modulesDir = path.join(__dirname, 'modules');

// Read existing course.json
const course = JSON.parse(fs.readFileSync(courseFile, 'utf8'));

// Read module files in order
const moduleFiles = ['m3.json', 'm4.json', 'm5.json', 'm6.json', 'm7.json', 'm8.json'];

let added = 0;
for (const mf of moduleFiles) {
  const fp = path.join(modulesDir, mf);
  if (!fs.existsSync(fp)) {
    console.log(`SKIP: ${mf} not found`);
    continue;
  }
  const mod = JSON.parse(fs.readFileSync(fp, 'utf8'));
  
  // Check if module already exists
  const existing = course.modules.findIndex(m => m.id === mod.id);
  if (existing >= 0) {
    course.modules[existing] = mod;
    console.log(`UPDATED: ${mod.id} - ${mod.title} (${mod.units.length} units)`);
  } else {
    course.modules.push(mod);
    console.log(`ADDED: ${mod.id} - ${mod.title} (${mod.units.length} units)`);
  }
  added++;
}

// Write back
fs.writeFileSync(courseFile, JSON.stringify(course, null, 2), 'utf8');

// Stats
let totalUnits = 0, totalExercises = 0;
for (const m of course.modules) {
  const mExercises = m.units.reduce((s, u) => s + u.exercises.length, 0);
  totalUnits += m.units.length;
  totalExercises += mExercises;
  console.log(`  ${m.id}: ${m.units.length} units, ${mExercises} exercises`);
}
console.log(`\nTOTAL: ${course.modules.length} modules, ${totalUnits} units, ${totalExercises} exercises`);
console.log(`Added/updated ${added} modules`);

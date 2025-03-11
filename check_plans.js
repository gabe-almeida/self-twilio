const fs = require('fs').promises;
const path = require('path');

async function checkPlanFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const incompleteTasks = [];

    for (const line of lines) {
      if (line.trim().startsWith('[ ]')) {
        incompleteTasks.push(line.trim());
      }
    }

    return {
      filePath,
      incompleteTasks
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return {
      filePath,
      error: error.message
    };
  }
}

async function checkAllPlans(plansDir) {
  try {
    const files = await fs.readdir(plansDir);
    const planFiles = files.filter(file => file.endsWith('.md'));
    const results = [];

    for (const file of planFiles) {
      const filePath = path.join(plansDir, file);
      const result = await checkPlanFile(filePath);
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error(`Error reading directory ${plansDir}:`, error);
    return [{
      error: error.message
    }];
  }
}

async function main() {
  const plansDir = path.join(__dirname, 'plans');
  const results = await checkAllPlans(plansDir);

  const incompletePlans = results.filter(result => result.incompleteTasks && result.incompleteTasks.length > 0);

  if (incompletePlans.length > 0) {
    console.log('Incomplete plans:');
    for (const plan of incompletePlans) {
      console.log(`- ${plan.filePath}:`);
      for (const task of plan.incompleteTasks) {
        console.log(`  - ${task}`);
      }
    }
  } else {
    console.log('No incomplete plans found.');
  }
    
  const errorPlans = results.filter(result => result.error);
    if (errorPlans.length > 0) {
        console.log('Errors reading plan files:');
        for (const plan of errorPlans) {
            console.log(`- ${plan.filePath}: ${plan.error}`);
        }
    }
}

main();
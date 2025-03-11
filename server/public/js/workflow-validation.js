/**
 * Workflow Visual Editor Validation Module
 * 
 * This module provides validation and testing utilities for the visual workflow editor.
 * It helps validate workflows and test different execution paths to ensure workflows
 * function as expected before deploying them to production.
 */

// Validation constants
const ERROR_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

/**
 * Validates a complete workflow for common issues and potential problems
 * @param {Object} workflow - The workflow object to validate
 * @returns {Array} - Array of validation issues with level, message, and affected steps
 */
function validateWorkflow(workflow) {
  if (!workflow) return [];
  
  const issues = [];
  
  // Validate workflow basic properties
  if (!workflow.name || workflow.name.trim() === '') {
    issues.push({
      level: ERROR_LEVELS.ERROR,
      message: 'Workflow name is required',
      step: null
    });
  }
  
  // Ensure we have steps
  if (!workflow.steps || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    issues.push({
      level: ERROR_LEVELS.ERROR,
      message: 'Workflow must have at least one step',
      step: null
    });
    return issues; // Can't continue validation without steps
  }
  
  // Check for start step
  const startStep = workflow.steps.find(step => step.type === 'start' || step.isStart === true);
  if (!startStep) {
    issues.push({
      level: ERROR_LEVELS.ERROR,
      message: 'Workflow must have a start step',
      step: null
    });
  }
  
  // Check for end step
  const endSteps = workflow.steps.filter(step => step.type === 'end');
  if (endSteps.length === 0) {
    issues.push({
      level: ERROR_LEVELS.ERROR,
      message: 'Workflow must have at least one end step',
      step: null
    });
  }
  
  // Check for orphaned nodes (nodes with no incoming connections)
  const connectedSteps = new Set();
  workflow.steps.forEach(step => {
    if (step.next_step) {
      connectedSteps.add(step.next_step);
    }
    if (step.true_branch) {
      connectedSteps.add(step.true_branch);
    }
    if (step.false_branch) {
      connectedSteps.add(step.false_branch);
    }
  });
  
  // Start node is not expected to have incoming connections
  if (startStep) {
    connectedSteps.add(startStep.id);
  }
  
  workflow.steps.forEach(step => {
    // Skip start node - it doesn't need incoming connections
    if (step.type === 'start' || step.isStart === true) {
      return;
    }
    
    if (!connectedSteps.has(step.id)) {
      issues.push({
        level: ERROR_LEVELS.WARNING,
        message: `Orphaned step: ${step.name || step.id} has no incoming connections`,
        step: step.id
      });
    }
  });
  
  // Validate individual step properties
  workflow.steps.forEach(step => {
    // Skip end nodes - they don't need outgoing connections
    if (step.type === 'end') {
      return;
    }
    
    // Check if step has outgoing connections
    if (step.type === 'condition' || step.type === 'disposition_condition' || 
        step.type === 'time_condition' || step.type === 'branch') {
      // Condition nodes should have true/false branches
      if (!step.true_branch && !step.false_branch) {
        issues.push({
          level: ERROR_LEVELS.WARNING,
          message: `Condition step ${step.name || step.id} has no outgoing connections`,
          step: step.id
        });
      } else if (!step.true_branch) {
        issues.push({
          level: ERROR_LEVELS.WARNING, 
          message: `Condition step ${step.name || step.id} has no 'true' branch connection`,
          step: step.id
        });
      } else if (!step.false_branch) {
        issues.push({
          level: ERROR_LEVELS.WARNING,
          message: `Condition step ${step.name || step.id} has no 'false' branch connection`,
          step: step.id
        });
      }
    } else if (!step.next_step) {
      // Non-condition nodes should have next_step
      issues.push({
        level: ERROR_LEVELS.WARNING,
        message: `Step ${step.name || step.id} has no outgoing connection`,
        step: step.id
      });
    }
    
    // Validate step-specific properties
    switch (step.type) {
      case 'call':
        if (!step.properties || !step.properties.priority) {
          issues.push({
            level: ERROR_LEVELS.WARNING,
            message: `Call step ${step.name || step.id} has no priority set`,
            step: step.id
          });
        }
        break;
        
      case 'wait':
        if (!step.properties || !step.properties.minutes) {
          issues.push({
            level: ERROR_LEVELS.WARNING,
            message: `Wait step ${step.name || step.id} has no wait time set`,
            step: step.id
          });
        }
        break;
        
      case 'sms':
        if (!step.properties || !step.properties.message || step.properties.message.trim() === '') {
          issues.push({
            level: ERROR_LEVELS.WARNING,
            message: `SMS step ${step.name || step.id} has empty message`,
            step: step.id
          });
        }
        break;
        
      case 'condition':
        if (!step.condition || !step.condition.field || !step.condition.operator) {
          issues.push({
            level: ERROR_LEVELS.WARNING,
            message: `Condition step ${step.name || step.id} has incomplete condition`,
            step: step.id
          });
        }
        break;
        
      case 'update_record':
        if (!step.properties || !step.properties.fields || Object.keys(step.properties.fields).length === 0) {
          issues.push({
            level: ERROR_LEVELS.WARNING,
            message: `Update Record step ${step.name || step.id} has no fields to update`,
            step: step.id
          });
        }
        break;
    }
  });
  
  // Check for infinite loops
  const loopPaths = findPotentialLoops(workflow);
  loopPaths.forEach(path => {
    issues.push({
      level: ERROR_LEVELS.WARNING,
      message: `Potential infinite loop detected: ${path.join(' → ')}`,
      step: path[0]
    });
  });
  
  return issues;
}

/**
 * Find potential loops in workflow
 * @param {Object} workflow - The workflow to analyze
 * @returns {Array} - Array of step paths that form loops
 */
function findPotentialLoops(workflow) {
  const loops = [];
  
  // For each step, perform DFS to find paths that lead back to itself
  workflow.steps.forEach(step => {
    const visited = new Set();
    const path = [];
    
    function dfs(currentStep, targetId) {
      if (!currentStep) return false;
      
      visited.add(currentStep.id);
      path.push(currentStep.id);
      
      // Check next steps
      let nextStepIds = [];
      if (currentStep.next_step) nextStepIds.push(currentStep.next_step);
      if (currentStep.true_branch) nextStepIds.push(currentStep.true_branch);
      if (currentStep.false_branch) nextStepIds.push(currentStep.false_branch);
      
      for (const nextId of nextStepIds) {
        if (nextId === targetId) {
          // Found a loop
          path.push(nextId);
          loops.push([...path]);
          path.pop();
          return true;
        }
        
        if (!visited.has(nextId)) {
          const nextStep = workflow.steps.find(s => s.id === nextId);
          if (nextStep && dfs(nextStep, targetId)) return true;
        }
      }
      
      path.pop();
      return false;
    }
    
    dfs(step, step.id);
  });
  
  return loops;
}

/**
 * Simulates execution of a workflow by tracing execution paths
 * @param {Object} workflow - The workflow to simulate
 * @param {Object} context - Initial context for simulation
 * @returns {Object} - Simulation results with paths and any issues encountered
 */
function simulateWorkflow(workflow, context = {}) {
  if (!workflow || !workflow.steps || !workflow.steps.length) {
    return { 
      success: false, 
      message: 'Invalid workflow or missing steps', 
      paths: [] 
    };
  }
  
  // Find start step
  const startStep = workflow.steps.find(step => step.type === 'start' || step.isStart === true);
  if (!startStep) {
    return { 
      success: false, 
      message: 'No start step found in workflow', 
      paths: [] 
    };
  }
  
  // Track all possible execution paths
  const paths = [];
  const maxPathLength = 100; // Safety limit to prevent infinite loops
  
  // Recursive function to trace paths through the workflow
  function tracePath(currentStep, currentPath = [], currentContext = {}, depth = 0) {
    // Prevent infinite loops
    if (depth > maxPathLength) {
      paths.push({
        path: [...currentPath, currentStep.id + ' (path too long - possible infinite loop)'],
        context: { ...currentContext },
        truncated: true
      });
      return;
    }
    
    // Add current step to path
    currentPath.push(currentStep.id);
    
    // Process step based on type and update context
    let nextStepId = null;
    let branchTaken = null;
    
    switch (currentStep.type) {
      case 'end':
        // End of path
        paths.push({
          path: [...currentPath],
          context: { ...currentContext },
          truncated: false
        });
        return;
        
      case 'condition':
      case 'disposition_condition':
      case 'time_condition':
      case 'branch':
        // Evaluate condition and follow both branches
        const condition = currentStep.condition || {};
        // Simulate true branch
        if (currentStep.true_branch) {
          const trueStep = workflow.steps.find(s => s.id === currentStep.true_branch);
          if (trueStep) {
            tracePath(
              trueStep,
              [...currentPath, `(TRUE)`],
              { 
                ...currentContext,
                _lastBranch: 'true'
              },
              depth + 1
            );
          }
        }
        
        // Simulate false branch
        if (currentStep.false_branch) {
          const falseStep = workflow.steps.find(s => s.id === currentStep.false_branch);
          if (falseStep) {
            tracePath(
              falseStep,
              [...currentPath, `(FALSE)`],
              { 
                ...currentContext,
                _lastBranch: 'false'
              },
              depth + 1
            );
          }
        }
        return;
        
      case 'wait':
        // Update context with wait time
        if (currentStep.properties) {
          currentContext._lastWaitTime = currentStep.properties.minutes || 0;
        }
        break;
        
      case 'call':
        // Update context with call properties
        if (currentStep.properties) {
          currentContext._lastCallPriority = currentStep.properties.priority || 1;
        }
        break;
        
      case 'sms':
        // Update context with SMS message
        if (currentStep.properties) {
          currentContext._lastSmsMessage = currentStep.properties.message || '';
        }
        break;
        
      case 'update_record':
        // Update context with field changes
        if (currentStep.properties && currentStep.properties.fields) {
          Object.entries(currentStep.properties.fields).forEach(([key, value]) => {
            currentContext[key] = value;
          });
        }
        break;
    }
    
    // Follow next step
    if (currentStep.next_step) {
      const nextStep = workflow.steps.find(s => s.id === currentStep.next_step);
      if (nextStep) {
        tracePath(nextStep, currentPath, currentContext, depth + 1);
      } else {
        // Next step not found
        paths.push({
          path: [...currentPath, currentStep.next_step + ' (not found)'],
          context: { ...currentContext },
          truncated: true,
          error: `Next step not found: ${currentStep.next_step}`
        });
      }
    } else if (currentStep.type !== 'condition' && 
              currentStep.type !== 'disposition_condition' && 
              currentStep.type !== 'time_condition' && 
              currentStep.type !== 'branch' && 
              currentStep.type !== 'end') {
      // No next step and not a condition or end
      paths.push({
        path: [...currentPath, '(dead end)'],
        context: { ...currentContext },
        truncated: true,
        error: 'Path ends with no end step'
      });
    }
  }
  
  // Start tracing from the start step
  tracePath(startStep, [], { ...context });
  
  return {
    success: true,
    paths: paths,
    stepCount: workflow.steps.length,
    problems: paths.filter(p => p.truncated || p.error).length
  };
}

// Export functions for use in workflow editor
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    validateWorkflow,
    findPotentialLoops,
    simulateWorkflow,
    ERROR_LEVELS
  };
} else {
  // For browser usage
  window.WorkflowValidation = {
    validateWorkflow,
    findPotentialLoops,
    simulateWorkflow,
    ERROR_LEVELS
  };
}
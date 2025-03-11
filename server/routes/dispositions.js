// Dispositions API Routes
const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../auth');
const store = require('../memory-store');

// Get all dispositions
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const dispositions = await store.dispositions.getAll();
    res.json({ dispositions });
  } catch (error) {
    console.error('Error getting dispositions:', error);
    res.status(500).json({ message: 'Error getting dispositions' });
  }
});

// Get active dispositions
router.get('/active', isAuthenticated, async (req, res) => {
  try {
    const dispositions = await store.dispositions.getActive();
    res.json({ dispositions });
  } catch (error) {
    console.error('Error getting active dispositions:', error);
    res.status(500).json({ message: 'Error getting active dispositions' });
  }
});

// Get disposition by ID
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const disposition = await store.dispositions.getById(req.params.id);
    
    if (!disposition) {
      return res.status(404).json({ message: 'Disposition not found' });
    }
    
    res.json(disposition);
  } catch (error) {
    console.error('Error getting disposition:', error);
    res.status(500).json({ message: 'Error getting disposition' });
  }
});

// Create new disposition
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, description, is_final, active } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Disposition name is required' });
    }
    
    const disposition = {
      id: `disp_${Date.now()}`,
      name,
      description: description || '',
      is_final: is_final || false,
      active: active !== undefined ? active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await store.dispositions.create(disposition);
    
    res.status(201).json(disposition);
  } catch (error) {
    console.error('Error creating disposition:', error);
    res.status(500).json({ message: 'Error creating disposition' });
  }
});

// Update disposition
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, description, is_final, active } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Disposition name is required' });
    }
    
    const existingDisposition = await store.dispositions.getById(req.params.id);
    
    if (!existingDisposition) {
      return res.status(404).json({ message: 'Disposition not found' });
    }
    
    const updatedDisposition = {
      ...existingDisposition,
      name,
      description: description || '',
      is_final: is_final !== undefined ? is_final : existingDisposition.is_final,
      active: active !== undefined ? active : existingDisposition.active,
      updated_at: new Date().toISOString()
    };
    
    await store.dispositions.update(req.params.id, updatedDisposition);
    
    res.json(updatedDisposition);
  } catch (error) {
    console.error('Error updating disposition:', error);
    res.status(500).json({ message: 'Error updating disposition' });
  }
});

// Delete disposition
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const existingDisposition = await store.dispositions.getById(req.params.id);
    
    if (!existingDisposition) {
      return res.status(404).json({ message: 'Disposition not found' });
    }
    
    await store.dispositions.delete(req.params.id);
    
    res.json({ message: 'Disposition deleted successfully' });
  } catch (error) {
    console.error('Error deleting disposition:', error);
    res.status(500).json({ message: 'Error deleting disposition' });
  }
});

module.exports = router;
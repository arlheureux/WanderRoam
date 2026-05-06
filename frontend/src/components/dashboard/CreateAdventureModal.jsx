import React from 'react';

export default function CreateAdventureModal({ 
  show, 
  newAdventure, 
  setNewAdventure, 
  creating, 
  onCreate, 
  onClose 
}) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>New Adventure</h2>
        <form onSubmit={onCreate}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={newAdventure.name}
              onChange={(e) => setNewAdventure({ ...newAdventure, name: e.target.value })}
              placeholder="My Great Adventure"
              required
            />
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={newAdventure.description}
              onChange={(e) => setNewAdventure({ ...newAdventure, description: e.target.value })}
              placeholder="A brief description..."
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

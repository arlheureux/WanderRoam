import React from 'react';

export default function CreateSeriesModal({ 
  show, 
  newSeries, 
  setNewSeries, 
  creatingSeries, 
  onCreate, 
  onClose 
}) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>New Series</h2>
        <form onSubmit={onCreate}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={newSeries.name}
              onChange={(e) => setNewSeries({ ...newSeries, name: e.target.value })}
              placeholder="Weekend Trip to Alps"
              required
            />
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={newSeries.description}
              onChange={(e) => setNewSeries({ ...newSeries, description: e.target.value })}
              placeholder="A multi-day hiking adventure..."
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={creatingSeries}>
              {creatingSeries ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

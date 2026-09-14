const { Adventure, AdventureShare } = require('../models');

const getAdventureAccess = async (adventureId, userId) => {
  const adventure = await Adventure.findByPk(adventureId);
  if (!adventure) return { adventure: null, canEdit: false, canView: false };

  if (adventure.user_id === userId) {
    return { adventure, canEdit: true, canView: true };
  }

  const share = await AdventureShare.findOne({
    where: { AdventureId: adventureId, UserId: userId }
  });

  if (!share) return { adventure: null, canEdit: false, canView: false };

  return {
    adventure,
    canEdit: share.permission === 'edit',
    canView: share.permission === 'view' || share.permission === 'edit'
  };
};

module.exports = { getAdventureAccess };
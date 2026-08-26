import React, { useEffect, useRef, useCallback, useState } from 'react';
import { getImageUrl } from '../utils/imageUrl';

const PictureLightbox = ({ pictures, currentIndex, onClose, onNavigate, onDelete }) => {
  const touchStart = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const picture = pictures[currentIndex];
  const hasMultiple = pictures.length > 1;

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    onNavigate(currentIndex > 0 ? currentIndex - 1 : pictures.length - 1);
  }, [currentIndex, pictures.length, hasMultiple, onNavigate]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    onNavigate(currentIndex < pictures.length - 1 ? currentIndex + 1 : 0);
  }, [currentIndex, pictures.length, hasMultiple, onNavigate]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? goNext() : goPrev();
    }
    touchStart.current = null;
  };

  useEffect(() => {
    setImgLoaded(false);
  }, [currentIndex]);

  if (!picture) return null;

  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="lightbox-container" onClick={e => e.stopPropagation()}>
        <img
          src={getImageUrl(picture.thumbnail_url)}
          alt={picture.filename}
          className="lightbox-image"
          onLoad={() => setImgLoaded(true)}
          style={{ opacity: imgLoaded ? 1 : 0 }}
        />
        {!imgLoaded && <div className="lightbox-spinner" />}
        {hasMultiple && (
          <>
            <button className="lightbox-nav lightbox-nav-prev" onClick={goPrev}>
              &#8592;
            </button>
            <button className="lightbox-nav lightbox-nav-next" onClick={goNext}>
              &#8594;
            </button>
            <div className="lightbox-counter">
              {currentIndex + 1} / {pictures.length}
            </div>
          </>
        )}
        <button className="lightbox-close" onClick={onClose}>
          &#10005;
        </button>
        {onDelete && (
          <button
            className="lightbox-action"
            onClick={() => onDelete(picture)}
          >
            &#128465;
          </button>
        )}
      </div>
    </div>
  );
};

export default PictureLightbox;

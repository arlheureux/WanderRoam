import React, { useEffect, useRef, useCallback, useState } from 'react';
import { getImageUrl } from '../utils/imageUrl';

const PictureLightbox = ({ pictures, currentIndex, onClose, onNavigate, onDelete }) => {
  const touchStart = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const dialogRef = useRef(null);

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

  // Single owner of keyboard navigation: this dialog. Pages must NOT add their
  // own keydown listeners for arrows/Escape, or each press fires twice.
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  // Focus management: move focus into the dialog on open and restore it on close.
  const closeButtonRef = useRef(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const raf = requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      previouslyFocused?.focus?.();
    };
  }, []);

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
      <div
        ref={dialogRef}
        className="lightbox-container"
        role="dialog"
        aria-modal="true"
        aria-label={pictures.length > 1 ? `Picture ${currentIndex + 1} of ${pictures.length}` : 'Picture viewer'}
        onClick={(e) => e.stopPropagation()}
      >
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
            <button
              type="button"
              className="lightbox-nav lightbox-nav-prev"
              onClick={goPrev}
              aria-label="Previous picture"
            >
              &#8592;
            </button>
            <button
              type="button"
              className="lightbox-nav lightbox-nav-next"
              onClick={goNext}
              aria-label="Next picture"
            >
              &#8594;
            </button>
            <div className="lightbox-counter" aria-hidden="true">
              {currentIndex + 1} / {pictures.length}
            </div>
          </>
        )}
        <button
          type="button"
          ref={closeButtonRef}
          className="lightbox-close"
          onClick={onClose}
          aria-label="Close picture viewer"
        >
          &#10005;
        </button>
        {onDelete && (
          <button
            type="button"
            className="lightbox-action"
            onClick={() => onDelete(picture)}
            aria-label={`Delete ${picture.filename}`}
          >
            &#128465;
          </button>
        )}
      </div>
    </div>
  );
};

export default PictureLightbox;

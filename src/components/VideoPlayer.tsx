import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sliders,
  Tv,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  poster,
  initialTime = 0,
  onTimeUpdate,
  onEnded,
  onPrevEpisode,
  onNextEpisode,
  hasPrevEpisode = false,
  hasNextEpisode = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [savedLastTime, setSavedLastTime] = useState(initialTime);

  // تنسيق الوقت (00:00 أو 00:00:00)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // التحكم بالتشغيل / الإيقاف
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // تقديم وتأخير 10 ثوانٍ
  const seekRelative = (delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  // تغيير موضع شريط التقدم
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const target = parseFloat(e.target.value);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  // التحكم بالصوت
  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  // سرعة التشغيل
  const handleRateChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  // ملء الشاشة
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // استئناف من الوقت المبدئي
  useEffect(() => {
    if (initialTime > 0 && videoRef.current) {
      videoRef.current.currentTime = initialTime;
    }
  }, [initialTime]);

  // التعافي الذكي من انقطاع الشبكة (Soft Error Recovery)
  const handleVideoError = () => {
    if (!videoRef.current || retryCount > 5) return;
    console.log(`🔄 انقطاع طفيف في دفق الفيديو، جارٍ الاستئناف التلقائي من الدقيقة ${formatTime(savedLastTime)}...`);
    setIsBuffering(true);
    setRetryCount((prev) => prev + 1);

    setTimeout(() => {
      if (videoRef.current) {
        const currentSrc = videoRef.current.src;
        videoRef.current.src = currentSrc;
        videoRef.current.load();
        videoRef.current.currentTime = savedLastTime;
        videoRef.current.play().then(() => {
          setIsBuffering(false);
          setRetryCount(0);
        }).catch(() => {});
      }
    }, 1500);
  };

  // إخفاء أزرار التحكم تلقائياً بعد ثانيتين ونصف من عدم الحركة
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 2600);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onContextMenu={(e) => e.preventDefault()} // Anti-Inspect: حظر قائمة الزر الأيمن
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: isTheater ? '100%' : '1080px',
        margin: '0 auto',
        borderRadius: isFullscreen ? '0' : '24px',
        overflow: 'hidden',
        background: '#0a1120',
        boxShadow: '0 20px 50px rgba(10, 17, 32, 0.45)',
        border: isFullscreen ? 'none' : '1px solid rgba(252, 163, 17, 0.22)',
        fontFamily: "'Tajawal', sans-serif",
        userSelect: 'none',
        aspectRatio: '16/9',
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onTimeUpdate={() => {
          if (!videoRef.current) return;
          const ct = videoRef.current.currentTime;
          const dur = videoRef.current.duration || 0;
          setCurrentTime(ct);
          setSavedLastTime(ct);
          onTimeUpdate?.(ct, dur);
        }}
        onLoadedMetadata={() => {
          if (!videoRef.current) return;
          setDuration(videoRef.current.duration || 0);
          if (initialTime > 0) {
            videoRef.current.currentTime = initialTime;
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
          setIsEnded(false);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setIsEnded(true);
          onEnded?.();
        }}
        onError={handleVideoError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          cursor: 'pointer',
        }}
      />

      {/* زر التشغيل الكبير في المنتصف */}
      {!isPlaying && !isBuffering && !isEnded && (
        <div
          onClick={togglePlay}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 17, 32, 0.4)',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#fca311',
              color: '#14213d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(252, 163, 17, 0.5)',
              transform: 'scale(1)',
              transition: 'transform 0.2s',
            }}
          >
            <Play size={36} fill="#14213d" style={{ marginLeft: '4px' }} />
          </div>
        </div>
      )}

      {/* شاشة التخزين المؤقت (Buffering / Auto-Retry) */}
      {isBuffering && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 17, 32, 0.65)',
            color: '#fca311',
            gap: '12px',
          }}
        >
          <RefreshCw size={44} className="spin" />
          <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>
            {retryCount > 0 ? 'استئناف الفيديو تلقائياً...' : 'جارٍ البث السحابي...'}
          </span>
        </div>
      )}

      {/* شاشة نهاية الفيديو (End Screen) */}
      {isEnded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10, 17, 32, 0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            color: '#fff',
            zIndex: 10,
          }}
        >
          <CheckCircle2 size={54} color="#2ec4b6" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '1.4rem', color: '#fca311', fontWeight: 700 }}>
            اكتملت مشاهدة الحلقة بنجاح!
          </h3>
          <p style={{ margin: '0 0 20px', color: '#cbd5e1', fontSize: '0.9rem' }}>
            {title ? title : 'يمكنك الانتقال للحلقة التالية أو إعادة التشغيل.'}
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {hasNextEpisode && (
              <button
                type="button"
                onClick={onNextEpisode}
                style={{
                  background: '#fca311',
                  color: '#14213d',
                  padding: '12px 24px',
                  borderRadius: '30px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(252, 163, 17, 0.4)',
                }}
              >
                الحلقة التالية ←
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play();
                }
              }}
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                padding: '12px 22px',
                borderRadius: '30px',
                border: '1px solid rgba(255,255,255,0.25)',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RotateCcw size={16} />
              إعادة التشغيل
            </button>
          </div>
        </div>
      )}

      {/* شريط التحكم السفلي المخصص بألوان الموقع (الكحلي الملكي والذهبي والتيل) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(10, 17, 32, 0.95) 0%, rgba(20, 33, 61, 0.75) 70%, transparent 100%)',
          padding: '24px 20px 14px',
          opacity: showControls || !isPlaying ? 1 : 0,
          transition: 'opacity 0.25s ease',
          pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
          zIndex: 5,
        }}
      >
        {/* عنوان الحلقة في الأعلى عند التحريك */}
        {title && (
          <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>
            {title}
          </div>
        )}

        {/* شريط التقدم التفاعلي باللون الذهبي */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ color: '#cbd5e1', fontSize: '0.78rem', minWidth: '45px', textAlign: 'center' }}>
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            style={{
              flex: 1,
              height: '5px',
              accentColor: '#fca311',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          />

          <span style={{ color: '#94a3b8', fontSize: '0.78rem', minWidth: '45px', textAlign: 'center' }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* أزرار التحكم السفلية */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* تشغيل / إيقاف */}
            <button
              type="button"
              onClick={togglePlay}
              style={{
                background: '#fca311',
                color: '#14213d',
                border: 'none',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isPlaying ? <Pause size={18} fill="#14213d" /> : <Play size={18} fill="#14213d" style={{ marginLeft: '2px' }} />}
            </button>

            {/* تأخير 10 ثوانٍ */}
            <button
              type="button"
              onClick={() => seekRelative(-10)}
              title="تأخير 10 ثوانٍ"
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px' }}
            >
              <RotateCcw size={18} />
            </button>

            {/* تقديم 10 ثوانٍ */}
            <button
              type="button"
              onClick={() => seekRelative(10)}
              title="تقديم 10 ثوانٍ"
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px' }}
            >
              <RotateCw size={18} />
            </button>

            {/* التنقل بين الحلقات */}
            {hasPrevEpisode && (
              <button
                type="button"
                onClick={onPrevEpisode}
                title="الحلقة السابقة"
                style={{ background: 'none', border: 'none', color: '#2ec4b6', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
              >
                السابقة
              </button>
            )}
            {hasNextEpisode && (
              <button
                type="button"
                onClick={onNextEpisode}
                title="الحلقة التالية"
                style={{ background: 'none', border: 'none', color: '#fca311', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
              >
                التالية
              </button>
            )}

            {/* التحكم في الصوت */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
              <button
                type="button"
                onClick={toggleMute}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} color="#fca311" /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ width: '65px', height: '4px', accentColor: '#fca311', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            {/* سرعة التشغيل */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fca311',
                  border: '1px solid rgba(252, 163, 17, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sliders size={13} />
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '36px',
                    left: 0,
                    background: '#14213d',
                    border: '1px solid #fca311',
                    borderRadius: '12px',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    zIndex: 20,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleRateChange(rate)}
                      style={{
                        background: playbackRate === rate ? '#fca311' : 'transparent',
                        color: playbackRate === rate ? '#14213d' : '#fff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* الوضع المسرحي */}
            <button
              type="button"
              onClick={() => setIsTheater(!isTheater)}
              title="الوضع المسرحي"
              style={{ background: 'none', border: 'none', color: isTheater ? '#fca311' : '#fff', cursor: 'pointer', padding: '6px' }}
            >
              <Tv size={18} />
            </button>

            {/* ملء الشاشة */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title="ملء الشاشة"
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px' }}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

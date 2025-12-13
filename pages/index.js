import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [audioFile, setAudioFile] = useState(null);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [baselineAverage, setBaselineAverage] = useState(null);
  const [volumeDifference, setVolumeDifference] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [selectedGif, setSelectedGif] = useState(null);
  const [ripples, setRipples] = useState([]);
  const [saturation, setSaturation] = useState(1);
  const [grainOpacity, setGrainOpacity] = useState(0.08);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const totalVolumeSumRef = useRef(0);
  const sampleCountRef = useRef(0);
  const rotationAngleRef = useRef(0);
  const previousVolumeRef = useRef(0);
  const rippleIdRef = useRef(0);

  const gifs = ['/cat.gif', '/matchaStir.gif', '/scenery.gif'];

  const getRandomGif = () => {
    const randomIndex = Math.floor(Math.random() * gifs.length);
    return gifs[randomIndex];
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "audio/mpeg") {
      setAudioFile(file);
      // Pick a random GIF when a new audio file is loaded
      setSelectedGif(getRandomGif());
    }
  };

  useEffect(() => {
    if (audioFile && audioRef.current) {
      const audio = audioRef.current;
      const url = URL.createObjectURL(audioFile);
      audio.src = url;
      audio.loop = true;

      // Set up Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaElementSource(audio);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Reset baseline calculation when new file is loaded
      totalVolumeSumRef.current = 0;
      sampleCountRef.current = 0;
      rotationAngleRef.current = 0;
      previousVolumeRef.current = 0;
      rippleIdRef.current = 0;
      setBaselineAverage(null);
      setVolumeDifference(0);
      setRotation(0);
      setRipples([]);
      setSaturation(1);
      setGrainOpacity(0.08);

      // Request fullscreen
      const requestFullscreen = async () => {
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          } else if (document.documentElement.webkitRequestFullscreen) {
            await document.documentElement.webkitRequestFullscreen();
          } else if (document.documentElement.msRequestFullscreen) {
            await document.documentElement.msRequestFullscreen();
          }
        } catch (error) {
          console.log("Fullscreen request failed:", error);
        }
      };
      requestFullscreen();

      // Autoplay audio
      audio.play().catch((error) => {
        console.log("Autoplay prevented:", error);
      });

      // Clean up URL when component unmounts or file changes
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [audioFile]);

  useEffect(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedVolume = average / 255; // Normalize to 0-1
      
      setCurrentVolume(normalizedVolume);

      // Continuously collect samples and calculate running average for entire track
      totalVolumeSumRef.current += normalizedVolume;
      sampleCountRef.current += 1;
      
      // Calculate baseline average from all samples collected so far
      // Start showing baseline after collecting at least 10 samples for initial reading
      if (sampleCountRef.current >= 10) {
        const baseline = totalVolumeSumRef.current / sampleCountRef.current;
        setBaselineAverage(baseline);
        
        // Calculate difference from baseline
        const difference = normalizedVolume - baseline;
        setVolumeDifference(difference);
        
        // Detect peak (volume is increasing and above threshold)
        const peakThreshold = 0.05; // 5% above baseline
        const previousVolume = previousVolumeRef.current;
        if (difference > peakThreshold && normalizedVolume > previousVolume) {
          // Create a new ripple
          const newRipple = {
            id: rippleIdRef.current++,
            size: 0,
            opacity: 0.8,
          };
          setRipples((prev) => [...prev, newRipple]);
        }
        previousVolumeRef.current = normalizedVolume;
        
        // Update saturation based on volume difference (0.5 to 1.5 range)
        const newSaturation = 1 + (difference * 2);
        setSaturation(Math.max(0.5, Math.min(1.5, newSaturation)));
        
        // Update grain opacity based on volume (subtle, 0.05 to 0.15 range)
        // More volume = more grain (like vinyl static)
        const baseGrain = 0.08;
        const grainVariation = Math.abs(difference) * 0.3;
        const newGrainOpacity = baseGrain + grainVariation;
        setGrainOpacity(Math.max(0.05, Math.min(0.15, newGrainOpacity)));
        
        // Calculate rotation speed based on difference
        // Positive difference = faster rotation, negative = slower rotation
        // Base rotation speed + difference modifier
        const rotationSpeed = 0.5 + (difference * 200); // degrees per frame
        rotationAngleRef.current += rotationSpeed;
        
        // Normalize rotation to 0-360
        if (rotationAngleRef.current >= 360) {
          rotationAngleRef.current -= 360;
        } else if (rotationAngleRef.current < 0) {
          rotationAngleRef.current += 360;
        }
        
        setRotation(rotationAngleRef.current);
      }
      
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioFile]);

  // Animate ripples
  useEffect(() => {
    if (ripples.length === 0) return;

    const interval = setInterval(() => {
      setRipples((prevRipples) => {
        return prevRipples
          .map((ripple) => ({
            ...ripple,
            size: ripple.size + 10,
            opacity: Math.max(0, ripple.opacity - 0.02),
          }))
          .filter((ripple) => ripple.opacity > 0 && ripple.size < 1000);
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [ripples.length]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        backgroundImage: audioFile ? 'url(/woodBG.png)' : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        cursor: audioFile ? 'none' : 'default',
        position: 'relative',
        filter: audioFile && baselineAverage !== null ? `saturate(${saturation})` : 'none',
      }}
    >
      {/* Grain overlay - subtle film grain effect synced with music */}
      {audioFile && baselineAverage !== null && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 100,
            opacity: grainOpacity,
            backgroundImage: `
              repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.1) 0px,
                transparent 1px,
                transparent 2px,
                rgba(0, 0, 0, 0.1) 3px
              ),
              repeating-linear-gradient(
                90deg,
                rgba(0, 0, 0, 0.1) 0px,
                transparent 1px,
                transparent 2px,
                rgba(0, 0, 0, 0.1) 3px
              )
            `,
            backgroundSize: '3px 3px',
            mixBlendMode: 'overlay',
          }}
        />
      )}
      {/* Left plant image */}
      {audioFile && baselineAverage !== null && (
        <img
          src="/plantLeft.png"
          alt="Plant"
          style={{
            position: 'absolute',
            left: '20px',
            top: '50%',
            transform: `translateY(calc(-50% + ${Math.sin(rotation * Math.PI / 180) * 3}px)) translateX(${Math.cos(rotation * Math.PI / 180) * 2}px)`,
            height: '400px',
            width: 'auto',
            zIndex: 3,
            pointerEvents: 'none',
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
      
      {/* Right coffee image */}
      {audioFile && baselineAverage !== null && (
        <img
          src="/coffeeRight.png"
          alt="Coffee"
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: `translateY(calc(-50% + ${Math.sin((rotation + 180) * Math.PI / 180) * 3}px)) translateX(${Math.cos((rotation + 180) * Math.PI / 180) * -2}px)`,
            height: '400px',
            width: 'auto',
            zIndex: 3,
            pointerEvents: 'none',
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
      
      {!audioFile ? (
        <input
          type="file"
          accept="audio/mpeg,audio/mp3"
          onChange={handleFileChange}
        />
      ) : (
        <>
          <audio ref={audioRef} loop />
          {baselineAverage !== null && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
              {/* Ripples */}
              {ripples.map((ripple) => (
                <div
                  key={ripple.id}
                  style={{
                    position: 'absolute',
                    width: `${ripple.size}px`,
                    height: `${ripple.size}px`,
                    borderRadius: '50%',
                    border: `2px solid rgba(255, 255, 255, ${ripple.opacity})`,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              ))}
              
              {/* Stone background behind record */}
              <img
                src="/stoneBehind.png"
                alt="Stone background"
                style={{
                  position: 'absolute',
                  width: '600px',
                  height: '600px',
                  objectFit: 'contain',
                  zIndex: 0,
                  filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.4)) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3))',
                }}
              />
              <div
                style={{
                  width: '450px',
                  height: '450px',
                  borderRadius: '50%',
                  backgroundColor: '#1a1a1a',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `rotate(${rotation}deg)`,
                  zIndex: 1,
                  boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5), 0 5px 15px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
                }}
              >
                {/* Grooves - start after label (33.3%) and continue to near edge (98%) */}
                {/* Based on 12" LP: grooves run from ~4" (label edge) to ~11.75" (near outer edge) */}
                <div
                  style={{
                    width: '441px',
                    height: '441px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    position: 'absolute',
                  }}
                />
                <div
                  style={{
                    width: '414px',
                    height: '414px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    position: 'absolute',
                  }}
                />
                <div
                  style={{
                    width: '382px',
                    height: '382px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    position: 'absolute',
                  }}
                />
                <div
                  style={{
                    width: '351px',
                    height: '351px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    position: 'absolute',
                  }}
                />
                <div
                  style={{
                    width: '315px',
                    height: '315px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    position: 'absolute',
                  }}
                />
                <div
                  style={{
                    width: '279px',
                    height: '279px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.02)',
                    position: 'absolute',
                  }}
                />
                <div
                  style={{
                    width: '247px',
                    height: '247px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.02)',
                    position: 'absolute',
                  }}
                />
                <div
                  style={{
                    width: '216px',
                    height: '216px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.02)',
                    position: 'absolute',
                  }}
                />
                
                {/* Center label - 33.3% of diameter (4" on a 12" record) */}
                <div
                  style={{
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {selectedGif && (
                    <img
                      src={selectedGif}
                      alt="Record center"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                  {/* Center hole - 2.38% of diameter (7.26mm on a 12" record), slightly larger for visibility */}
                  <div
                    style={{
                      width: '11px',
                      height: '11px',
                      borderRadius: '50%',
                      backgroundColor: '#000',
                      position: 'absolute',
                      zIndex: 1,
                    }}
                  />
                </div>
              </div>
            </div>
            )}
        </>
      )}
    </div>
  );
}

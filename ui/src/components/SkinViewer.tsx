import { useEffect, useRef, useState } from "react";
import { SkinViewer as SkinView3D, WalkingAnimation, IdleAnimation } from "skinview3d";

interface SkinViewerProps {
  skinUrl: string;
  capeUrl?: string | null;
  width?: number;
  height?: number;
  animation?: "idle" | "walking" | "none";
  zoom?: number;
  className?: string;
}

export function SkinViewer({
  skinUrl,
  capeUrl,
  width = 200,
  height = 300,
  animation = "idle",
  zoom = 0.9,
  className,
}: SkinViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinView3D | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    setIsLoading(true);
    setError(null);

    // Create the viewer
    const viewer = new SkinView3D({
      canvas: canvasRef.current,
      width,
      height,
      skin: skinUrl,
      cape: capeUrl ?? undefined,
      zoom,
      fov: 50,
    });

    // Set animation
    if (animation === "walking") {
      viewer.animation = new WalkingAnimation();
      viewer.animation.speed = 0.7;
    } else if (animation === "idle") {
      viewer.animation = new IdleAnimation();
    }

    // Configure controls
    viewer.controls.enableRotate = true;
    viewer.controls.enableZoom = false;
    viewer.controls.enablePan = false;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 1.5;

    // Set camera angle
    viewer.camera.position.set(-20, 10, 50);
    viewer.camera.lookAt(0, 10, 0);

    viewerRef.current = viewer;

    // Handle load completion
    const checkLoaded = () => {
      setIsLoading(false);
    };

    // Give it a moment to load
    const timeout = setTimeout(checkLoaded, 500);

    return () => {
      clearTimeout(timeout);
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [skinUrl, capeUrl, width, height, animation, zoom]);

  // Update skin/cape when they change
  useEffect(() => {
    if (!viewerRef.current) return;

    viewerRef.current.loadSkin(skinUrl).catch((err) => {
      console.error("Failed to load skin:", err);
      setError("Failed to load skin");
    });
  }, [skinUrl]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (capeUrl) {
      viewerRef.current.loadCape(capeUrl).catch((err) => {
        console.error("Failed to load cape:", err);
      });
    } else {
      viewerRef.current.resetCape();
    }
  }, [capeUrl]);

  return (
    <div className={`skin-viewer ${className ?? ""}`} style={{ position: "relative", width, height }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: 16,
          }}
        >
          <div className="skin-viewer-loading" />
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(248, 113, 113, 0.1)",
            borderRadius: 16,
            color: "var(--accent-danger)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: 16,
          background: "linear-gradient(180deg, rgba(124, 199, 255, 0.05) 0%, rgba(244, 178, 127, 0.03) 100%)",
        }}
      />
    </div>
  );
}

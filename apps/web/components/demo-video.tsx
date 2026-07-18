"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const respectMotionPreference = () => {
      if (!mediaQuery.matches) return;
      videoRef.current?.pause();
      setIsPlaying(false);
    };

    respectMotionPreference();
    mediaQuery.addEventListener("change", respectMotionPreference);
    return () =>
      mediaQuery.removeEventListener("change", respectMotionPreference);
  }, []);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
      setIsPlaying(true);
      return;
    }

    video.pause();
    setIsPlaying(false);
  }

  return (
    <figure className="demo-video">
      <video
        aria-describedby="demo-transcript"
        autoPlay
        loop
        muted
        playsInline
        poster="/media/telic-recommendation-bias-poster.webp"
        preload="metadata"
        ref={videoRef}
      >
        <source
          src="/media/telic-recommendation-bias-demo.mp4"
          type="video/mp4"
        />
        Your browser does not support this video format.
      </video>
      <figcaption>
        <span>Silent product walkthrough · 22 seconds</span>
        <button
          aria-label={
            isPlaying ? "Pause product walkthrough" : "Play product walkthrough"
          }
          className="demo-video-control"
          onClick={togglePlayback}
          type="button"
        >
          {isPlaying ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
          {isPlaying ? "Pause" : "Play"}
        </button>
      </figcaption>
    </figure>
  );
}

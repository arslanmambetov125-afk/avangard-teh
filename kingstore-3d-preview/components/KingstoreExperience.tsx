"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

const PhoneCanvas = dynamic(() => import("./PhoneCanvas"), {
  ssr: false,
  loading: () => <div className="canvas-loading">Инициализация WebGL…</div>,
});

const STORY = [
  ["01", "СИЛУЭТ", "Сначала продукт читается целиком — без визуального шума."],
  ["02", "АРХИТЕКТУРА", "Корпус, дисплей, камеры и чип расходятся в глубину."],
  ["03", "ФОКУС", "Движение подводит взгляд к характеристикам, а не отвлекает."],
  ["04", "СБОРКА", "Объект снова становится целым и передаёт пользователя к выгоде."],
] as const;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function KingstoreExperience() {
  const root = useRef<HTMLElement>(null);
  const story = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [sceneActive, setSceneActive] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const reducedMotion = useReducedMotion();
  const motionOff = reducedMotion || !motionEnabled;

  useEffect(() => {
    const node = story.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setSceneActive(entry.isIntersecting), {
      rootMargin: "70% 0px 70% 0px",
      threshold: 0,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (motionOff) return;
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
    const raf = (time: number) => lenis.raf(time * 1000);
    const refresh = () => ScrollTrigger.update();
    lenis.on("scroll", refresh);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      lenis.off("scroll", refresh);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [motionOff]);

  useGSAP(
    () => {
      if (!root.current || !story.current) return;
      gsap.registerPlugin(ScrollTrigger);

      if (motionOff) {
        progress.current = 0.5;
        story.current.style.setProperty("--story-progress", "0.5");
        return;
      }

      gsap.from(".hero-kicker, .hero h1 span, .hero-copy, .hero-actions", {
        y: 28,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: "power3.out",
      });

      const state = { value: 0 };
      gsap.to(state, {
        value: 1,
        ease: "none",
        onUpdate: () => {
          progress.current = state.value;
          story.current?.style.setProperty("--story-progress", state.value.toFixed(4));
        },
        scrollTrigger: {
          trigger: story.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
      });

      const cards = gsap.utils.toArray<HTMLElement>(".story-card", story.current);
      cards.forEach((card, index) => {
        gsap.fromTo(
          card,
          { autoAlpha: index === 0 ? 1 : 0.24, x: index === 0 ? 0 : 16 },
          {
            autoAlpha: 1,
            x: 0,
            scrollTrigger: {
              trigger: story.current,
              start: `${index * 24}% top`,
              end: `${Math.min(100, index * 24 + 20)}% top`,
              scrub: true,
            },
          },
        );
      });

      gsap.from(".benefit", {
        y: 42,
        autoAlpha: 0,
        duration: 0.8,
        stagger: 0.12,
        scrollTrigger: { trigger: ".benefits", start: "top 76%" },
      });
    },
    { scope: root, dependencies: [motionOff], revertOnUpdate: true },
  );

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: motionOff ? "auto" : "smooth" });
  };

  return (
    <main className="site" ref={root}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => scrollTo("top")}>
          <b>KING</b>STORE
        </button>
        <div className="topbar-meta">
          <span>UFA · NON-OFFICIAL CONCEPT</span>
          <button
            className="motion-toggle"
            type="button"
            aria-pressed={motionEnabled}
            onClick={() => setMotionEnabled((value) => !value)}
          >
            MOTION {motionOff ? "OFF" : "ON"}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-inner">
          <div className="hero-copy-block">
            <p className="hero-kicker">KINGSTORE / WEB LAB / CONCEPT 03</p>
            <h1>
              <span>PRODUCT</span>
              <span><em>IS THE HERO.</em></span>
            </h1>
            <p className="hero-copy">
              Не каталог и не набор карточек. Одна управляемая история, где продукт,
              движение и оффер работают вместе.
            </p>
            <div className="hero-actions">
              <button className="button button-yellow" type="button" onClick={() => scrollTo("product-story")}>
                Войти в 3D-сцену ↓
              </button>
              <button className="button button-ghost" type="button" onClick={() => scrollTo("offer")}>
                Смотреть выгоды ↗
              </button>
            </div>
          </div>
          <div className="hero-monogram" aria-hidden="true">
            <span>3</span><span>D</span>
          </div>
        </div>
        <div className="hero-footer"><span>SCROLL TO ENTER</span><span>01 / 04</span></div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div>KINGSTORE · TRUE 3D · TRADE-IN · 0% · UFA · MOTION FIRST · PRODUCT EXPERIENCE · </div>
      </div>

      <section className="product-story" id="product-story" ref={story}>
        <div className="story-stage">
          <div className="story-copy">
            <p className="eyebrow">01 / TRUE 3D PRODUCT STORY</p>
            <h2>PRO.<br /><em>ПО СЛОЯМ.</em></h2>
            <p className="story-summary">
              Один сильный WebGL-момент вместо тяжёлого 3D на каждой секции. Скролл становится режиссурой.
            </p>
            <div className="story-list">
              {STORY.map(([number, title, body]) => (
                <article className="story-card" key={number}>
                  <span>{number}</span>
                  <div><h3>{title}</h3><p>{body}</p></div>
                </article>
              ))}
            </div>
          </div>

          <div className="story-visual" aria-label="Интерактивная трёхмерная сцена смартфона">
            <div className="grid-lines" aria-hidden="true" />
            <PhoneCanvas progress={progress} active={sceneActive && !motionOff} staticMode={motionOff} />
            <span className="visual-meta visual-meta-top">WEBGL / ADAPTIVE DPR</span>
            <span className="visual-meta visual-meta-bottom">SCROLL + POINTER / 0—1</span>
          </div>
        </div>
      </section>

      <section className="offer" id="offer">
        <div className="offer-heading">
          <p className="eyebrow">02 / SALES LAYER</p>
          <h2>ВАУ-ЭФФЕКТ<br /><em>ДОЛЖЕН ПРОДАВАТЬ.</em></h2>
        </div>
        <div className="benefits">
          <article className="benefit"><span>01</span><h3>TRADE-IN</h3><p>Показываем обмен как понятный путь к новому устройству.</p></article>
          <article className="benefit"><span>02</span><h3>0% / 24</h3><p>Переводим большую стоимость в доступный ежемесячный сценарий.</p></article>
          <article className="benefit"><span>03</span><h3>UFA</h3><p>Закрепляем доверие физическими магазинами и локальной доступностью.</p></article>
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">03 / NEXT ACTION</p>
        <h2>ВАШ<br />СЛЕДУЮЩИЙ?</h2>
        <div>
          <p>В рабочей версии здесь подключаются Telegram, WhatsApp или CRM и реальная форма заявки.</p>
          <button className="button button-dark" type="button">Получить консультацию ↗</button>
        </div>
      </section>

      <footer><span>ARSLAN WEB LAB / MOTION &amp; 3D V1</span><span>PROCEDURAL MODEL · NO EXTERNAL ASSETS</span></footer>
    </main>
  );
}

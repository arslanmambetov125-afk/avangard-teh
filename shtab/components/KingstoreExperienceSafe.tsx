"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

type ProductKey = "iphone" | "mac" | "pods" | "watch";
type PhoneTone = "orange" | "blue" | "silver";

const PHONE_IMG = "https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro.png?width=1000";
const MAC_IMG = "https://commons.wikimedia.org/wiki/Special:Redirect/file/MacBook_Air_M4.svg?width=1200";
const PODS_IMG = "https://commons.wikimedia.org/wiki/Special:Redirect/file/AirPods_Pro_2.jpg?width=1200";
const WATCH_IMG = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Apple_Watch_Series_10.png?width=1000";
const STORE_IMG = "https://avatars.mds.yandex.net/get-altay/15181550/2a00000196d44d56ec0707067224eb35d743/XXL_height";

const products = [
  { key: "iphone" as const, label: "iPhone 17 Pro", image: PHONE_IMG, meta: "PRO / 2025" },
  { key: "mac" as const, label: "MacBook Air", image: MAC_IMG, meta: "AIR / M4" },
  { key: "pods" as const, label: "AirPods Pro", image: PODS_IMG, meta: "AUDIO / PRO" },
  { key: "watch" as const, label: "Apple Watch", image: WATCH_IMG, meta: "WATCH / SERIES 10" },
];

const stores = [
  ["Революционная, 66", "ежедневно 10:00–21:00"],
  ["Верхнеторговая, 6", "ежедневно 10:00–21:00"],
  ["Энтузиастов, 7", "ежедневно 10:00–21:00"],
  ["Космонавтов, 14", "ежедневно 10:00–21:00"],
  ["пр-т Октября, 4/1", "ежедневно 10:00–22:00"],
];

const oldModels = [
  { name: "iPhone 16 Pro", value: 65000 },
  { name: "iPhone 15 Pro", value: 52000 },
  { name: "iPhone 14 Pro", value: 39000 },
  { name: "iPhone 13 Pro", value: 27000 },
  { name: "iPhone 12", value: 17000 },
];

const conditions = [
  { name: "Отличное", factor: 1 },
  { name: "Хорошее", factor: 0.86 },
  { name: "Есть следы использования", factor: 0.68 },
  { name: "Есть повреждения", factor: 0.43 },
];

export default function KingstoreExperienceSafe() {
  const rootRef = useRef<HTMLElement | null>(null);
  const heroVisualRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<number | null>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [motionReady, setMotionReady] = useState(false);
  const [selected, setSelected] = useState<ProductKey>("iphone");
  const [phoneTone, setPhoneTone] = useState<PhoneTone>("orange");
  const [months, setMonths] = useState(24);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [oldModel, setOldModel] = useState(65000);
  const [condition, setCondition] = useState(1);
  const [leadMessage, setLeadMessage] = useState("");

  const estimate = Math.round((oldModel * condition) / 1000) * 1000;
  const payment = Math.round(129990 / months);
  const selectedIndex = products.findIndex((item) => item.key === selected);
  const particles = useMemo(() => Array.from({ length: 54 }, (_, index) => index), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !motionEnabled) {
      root.dataset.motion = "off";
      setMotionReady(false);
      return;
    }

    let cancelled = false;
    let ctx: { revert: () => void } | null = null;
    let scrollTriggerApi: { getAll: () => Array<{ kill: () => void }>; refresh: () => void } | null = null;
    const cleanups: Array<() => void> = [];

    const boot = async () => {
      try {
        const [gsapModule, triggerModule] = await Promise.all([
          import("gsap"),
          import("gsap/dist/ScrollTrigger"),
        ]);
        if (cancelled) return;

        const gsap = (gsapModule as any).gsap ?? (gsapModule as any).default;
        const ScrollTrigger = (triggerModule as any).ScrollTrigger ?? (triggerModule as any).default;
        if (!gsap || !ScrollTrigger) throw new Error("GSAP runtime unavailable");

        gsap.registerPlugin(ScrollTrigger);
        scrollTriggerApi = ScrollTrigger;
        root.dataset.motion = "on";
        setMotionReady(true);

        ctx = gsap.context(() => {
          const hero = root.querySelector<HTMLElement>(".hero");
          const heroPhone = root.querySelector<HTMLElement>(".hero__phone");
          const heroVisual = heroVisualRef.current;
          const marquee = root.querySelector<HTMLElement>(".marquee__track");

          if (hero && heroPhone) {
            gsap.to(heroPhone, {
              yPercent: 24,
              rotation: 3,
              scale: 0.88,
              opacity: 0.58,
              ease: "none",
              scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.7 },
            });
          }

          if (marquee) {
            gsap.to(marquee, {
              xPercent: -26,
              ease: "none",
              scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 1.15 },
            });
          }

          if (heroVisual && heroPhone) {
            const xTo = gsap.quickTo(heroPhone, "x", { duration: 0.5, ease: "power3.out" });
            const yTo = gsap.quickTo(heroPhone, "y", { duration: 0.5, ease: "power3.out" });
            const rTo = gsap.quickTo(heroPhone, "rotation", { duration: 0.5, ease: "power3.out" });
            const move = (event: PointerEvent) => {
              const rect = heroVisual.getBoundingClientRect();
              if (!rect.width || !rect.height) return;
              const x = event.clientX - rect.left - rect.width / 2;
              const y = event.clientY - rect.top - rect.height / 2;
              xTo((x / rect.width) * 34);
              yTo((y / rect.height) * 22);
              rTo(-7 + (x / rect.width) * 8);
            };
            const leave = () => { xTo(0); yTo(0); rTo(-7); };
            heroVisual.addEventListener("pointermove", move);
            heroVisual.addEventListener("pointerleave", leave);
            cleanups.push(() => {
              heroVisual.removeEventListener("pointermove", move);
              heroVisual.removeEventListener("pointerleave", leave);
            });
          }

          const story = root.querySelector<HTMLElement>("#product-story");
          const storyStage = story?.querySelector<HTMLElement>(".motion-stage");
          if (story && storyStage) {
            const tl = gsap.timeline({
              defaults: { ease: "power2.inOut" },
              scrollTrigger: { trigger: story, start: "top top", end: "bottom bottom", pin: storyStage, pinSpacing: false, scrub: 1 },
            });
            tl.to(".progress__bar--story", { width: "100%", ease: "none", duration: 1 }, 0)
              .to(".explode__base", { xPercent: -42, rotation: -7, scale: 0.91, duration: 0.46 }, 0.08)
              .to(".explode__camera", { xPercent: -170, yPercent: -52, rotation: -18, scale: 1.08, duration: 0.46 }, 0.08)
              .to(".explode__frame", { xPercent: 46, rotationY: 20, scale: 0.94, duration: 0.46 }, 0.08)
              .to(".explode__display", { xPercent: 118, rotationY: 32, scale: 0.9, duration: 0.46 }, 0.08)
              .to(".explode__chip", { xPercent: 42, yPercent: 145, rotation: 8, scale: 1.12, duration: 0.46 }, 0.08)
              .to(".tech-label", { opacity: 1, stagger: 0.045, duration: 0.16 }, 0.24)
              .to(".tech-label", { opacity: 0, stagger: 0.03, duration: 0.12 }, 0.68)
              .to([".explode__base", ".explode__camera", ".explode__frame", ".explode__display", ".explode__chip"], {
                xPercent: 0, yPercent: 0, rotation: 0, rotationY: 0, scale: 1, duration: 0.3, stagger: 0.018,
              }, 0.7);
          }

          const trade = root.querySelector<HTMLElement>("#trade-story");
          const tradeStage = trade?.querySelector<HTMLElement>(".motion-stage");
          if (trade && tradeStage) {
            const tl = gsap.timeline({
              scrollTrigger: { trigger: trade, start: "top top", end: "bottom bottom", pin: tradeStage, pinSpacing: false, scrub: 1 },
            });
            tl.to(".trade-old", { xPercent: -70, rotation: -13, scale: 0.78, opacity: 0.04, duration: 0.52, ease: "power2.in" }, 0.08)
              .to(".trade-beam", { scaleX: 1, duration: 0.28, ease: "power2.out" }, 0.13)
              .to(".particle", { opacity: 1, duration: 0.08, stagger: 0.002 }, 0.17)
              .to(".particle", {
                x: (index: number) => 145 + ((index * 37) % 360),
                y: (index: number) => -115 + ((index * 83) % 245),
                scale: (index: number) => 0.6 + ((index * 17) % 12) / 10,
                opacity: 0,
                duration: 0.42,
                stagger: 0.001,
                ease: "power2.out",
              }, 0.2)
              .fromTo(".trade-new", { xPercent: 80, rotation: 10, scale: 0.78, opacity: 0 }, { xPercent: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.28)
              .to(".trade-result", { opacity: 1, y: -8, duration: 0.2 }, 0.68);
          }

          const zero = root.querySelector<HTMLElement>("#zero-story");
          const zeroStage = zero?.querySelector<HTMLElement>(".motion-stage");
          if (zero && zeroStage) {
            const travel = Math.min(window.innerWidth * 0.45, 620);
            const tl = gsap.timeline({
              scrollTrigger: { trigger: zero, start: "top top", end: "bottom bottom", pin: zeroStage, pinSpacing: false, scrub: 1 },
            });
            tl.fromTo(".zero-phone", { x: -travel, rotation: -14, scale: 0.82 }, { x: travel, rotation: 11, scale: 1.04, duration: 1, ease: "none" }, 0)
              .fromTo(".zero-number", { scale: 0.83, opacity: 0.36 }, { scale: 1.05, opacity: 0.94, duration: 0.5, ease: "power2.out" }, 0)
              .to(".zero-number", { scale: 0.92, opacity: 0.64, duration: 0.5 }, 0.5);
          }

          const city = root.querySelector<HTMLElement>(".city");
          if (city) {
            gsap.fromTo(".city__photo img", { scale: 1.08, yPercent: -2 }, {
              scale: 1.01, yPercent: 2, ease: "none",
              scrollTrigger: { trigger: city, start: "top bottom", end: "bottom top", scrub: 1 },
            });
            gsap.from(".address", {
              y: 18, opacity: 0, stagger: 0.07, duration: 0.55, ease: "power2.out",
              scrollTrigger: { trigger: ".city__addresses", start: "top 78%" },
            });
          }

          const final = root.querySelector<HTMLElement>(".final");
          if (final) {
            gsap.from(".final__title", {
              yPercent: 25, opacity: 0, duration: 0.85, ease: "power3.out",
              scrollTrigger: { trigger: final, start: "top 72%" },
            });
          }
        }, root);

        requestAnimationFrame(() => {
          try { ScrollTrigger.refresh(); } catch { /* progressive enhancement */ }
        });
      } catch (error) {
        console.error("KINGSTORE motion disabled:", error);
        root.dataset.motion = "off";
        setMotionReady(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      try { ctx?.revert(); } catch { /* noop */ }
      try { scrollTriggerApi?.getAll().forEach((trigger) => trigger.kill()); } catch { /* noop */ }
    };
  }, [motionEnabled]);

  useEffect(() => {
    if (!tradeOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setTradeOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tradeOpen]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: motionEnabled ? "smooth" : "auto", block: "start" });
  }

  function cycleProduct(direction: 1 | -1) {
    const nextIndex = (selectedIndex + direction + products.length) % products.length;
    setSelected(products[nextIndex].key);
  }

  function onSwipeStart(event: ReactPointerEvent<HTMLDivElement>) { swipeStartRef.current = event.clientX; }
  function onSwipeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (swipeStartRef.current === null) return;
    const delta = event.clientX - swipeStartRef.current;
    if (Math.abs(delta) > 48) cycleProduct(delta < 0 ? 1 : -1);
    swipeStartRef.current = null;
  }

  function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (!name || phone.replace(/\D/g, "").length < 6) {
      setLeadMessage("Заполните имя и телефон.");
      return;
    }
    setLeadMessage("Демо-заявка принята. В production подключим CRM / Telegram / WhatsApp.");
  }

  const phoneFilter = phoneTone === "orange"
    ? "saturate(.9) contrast(1.04)"
    : phoneTone === "blue"
      ? "hue-rotate(148deg) saturate(.72) brightness(.84) contrast(1.1)"
      : "grayscale(1) brightness(1.15) contrast(.94)";

  return (
    <main className="ks-site" ref={rootRef}>
      <nav className="ks-nav" aria-label="Основная навигация">
        <button className="ks-logo" type="button" onClick={() => scrollTo("home")} aria-label="KINGSTORE — наверх"><strong>KING</strong>STORE</button>
        <div className="ks-nav__right">
          <span className="ks-nav__meta">UFA · NON-OFFICIAL DIGITAL CONCEPT</span>
          <button className="ks-nav__motion" type="button" aria-pressed={motionEnabled} onClick={() => setMotionEnabled((value) => !value)}>
            Motion {motionEnabled && motionReady ? "on" : motionEnabled ? "loading" : "off"}
          </button>
        </div>
      </nav>

      <section className="hero" id="home">
        <div className="section-shell hero__grid">
          <div className="hero__copy">
            <div className="eyebrow">KINGSTORE / UFA / CONCEPT 01</div>
            <h1 className="hero__title"><span className="yellow">KING</span><br />MODE.</h1>
            <div className="hero__subline">Техника перестаёт быть каталогом. Она становится digital‑опытом.</div>
            <p className="hero__desc">Оригинальная техника Apple, Trade‑in, рассрочка и магазины в Уфе — собраны в одну непрерывную визуальную историю.</p>
            <div className="actions">
              <button type="button" className="btn btn--yellow" onClick={() => scrollTo("product-story")}>Смотреть концепт ↓</button>
              <button type="button" className="btn btn--dark" onClick={() => scrollTo("final")}>Получить консультацию ↗</button>
            </div>
          </div>
          <div className="hero__visual" ref={heroVisualRef}>
            <div className="hero__glow" /><div className="hero__orb" />
            <img className="product-img hero__phone" src={PHONE_IMG} alt="iPhone 17 Pro" fetchPriority="high" />
            <span className="hero__hint">двигайте курсор →</span>
          </div>
        </div>
        <div className="hero__scroll">scroll to enter / 01</div>
      </section>

      <div className="marquee"><div className="marquee__track">
        {['KINGSTORE','iPhone','Trade‑in','0% до 24 месяцев','UFA','Motion first','KINGSTORE','iPhone','Trade‑in'].map((item, i) => <span key={`${item}-${i}`}>{item}</span>)}
      </div></div>

      <section className="motion-section" id="product-story">
        <div className="motion-stage"><div className="section-shell motion-stage__grid">
          <div className="motion-copy"><div className="eyebrow">01 / PRODUCT STORY</div><h2 className="motion-title">PRO.<br /><span className="yellow">ПО СЛОЯМ.</span></h2><p className="motion-desc">Прокрутка становится режиссурой: камера, корпус, дисплей и A19 Pro расходятся по глубине, а затем снова собираются.</p><div className="progress"><div className="progress__bar progress__bar--story" /></div></div>
          <div className="explode"><div className="explode__display" /><div className="explode__frame" /><div className="explode__chip">A19<br />PRO</div><img className="product-img explode__base" src={PHONE_IMG} alt="iPhone 17 Pro" /><div className="explode__camera"><span className="lens" /><span className="lens" /><span className="lens" /></div><span className="tech-label tech-label--1">48 MP Fusion Camera</span><span className="tech-label tech-label--2">Aluminum unibody</span><span className="tech-label tech-label--3">A19 Pro</span><span className="tech-label tech-label--4">Super Retina XDR</span></div>
        </div></div>
      </section>

      <section className="motion-section" id="trade-story">
        <div className="motion-stage"><div className="section-shell motion-stage__grid">
          <div className="motion-copy"><div className="eyebrow">02 / TRADE‑IN</div><h2 className="motion-title">TRADE<br /><span className="yellow">UP.</span></h2><p className="motion-desc">Старый смартфон распадается на жёлтый световой поток, а новый iPhone появляется из него.</p><button type="button" className="btn btn--yellow trade-cta" onClick={() => setTradeOpen(true)}>Оценить устройство ↗</button></div>
          <div className="trade-space"><div className="trade-old"><div className="trade-old__camera" /></div><div className="trade-beam" /><div className="particles">{particles.map((id) => <span className="particle" key={id} />)}</div><img className="product-img trade-new" src={PHONE_IMG} alt="Новый iPhone" /><div className="trade-result"><small>предварительная оценка до</small><strong>{estimate.toLocaleString('ru-RU')} ₽</strong></div></div>
        </div></div>
      </section>

      <section className="motion-section" id="zero-story">
        <div className="motion-stage"><div className="section-shell motion-stage__grid">
          <div className="motion-copy"><div className="eyebrow">03 / INSTALLMENT</div><h2 className="motion-title">БОЛЬШОЙ<br /><span className="yellow">0%.</span></h2><p className="motion-desc">Ноль — не подпись, а объект сцены. iPhone проходит через него при скролле.</p><div className="finance-ui"><div className="finance-ui__label"><span>Срок</span><strong>{months} мес.</strong></div><input aria-label="Срок рассрочки" type="range" min={6} max={24} step={6} value={months} onChange={(e) => setMonths(Number(e.target.value))} /><div className="finance-ui__ticks"><span>6</span><span>12</span><span>18</span><span>24</span></div><div className="finance-ui__payment">≈ <span>{payment.toLocaleString('ru-RU')} ₽</span> / мес.*</div></div></div>
          <div className="zero-space"><div className="zero-number">0</div><img className="product-img zero-phone" src={PHONE_IMG} alt="iPhone" /></div>
        </div></div>
      </section>

      <section className="city" id="ufa">
        <div className="city__photo"><img src={STORE_IMG} alt="" /></div>
        <div className="section-shell city__inner"><div><div className="eyebrow">04 / KINGSTORE / UFA</div><div className="city__word"><span className="yellow">KING</span><br />В ГОРОДЕ.</div><div className="city__badge">точки KINGSTORE в Уфе</div></div><div className="city__addresses">{stores.map(([address, hours]) => <div className="address" key={address}><strong>{address}</strong>{hours}</div>)}</div></div>
      </section>

      <section className="selector" id="devices">
        <div className="section-shell selector__grid"><div><div className="eyebrow">05 / CHOOSE YOURS</div><h2 className="motion-title">ОДИН<br /><span className="yellow">ОБЪЕКТ.</span></h2><p className="motion-desc">Никакой стены из карточек. На экране живёт только один продукт.</p><div className="selector__menu">{products.map((product) => <button type="button" className="product-tab" key={product.key} aria-pressed={selected === product.key} onClick={() => setSelected(product.key)}>{product.label}</button>)}</div>{selected === 'iphone' && <div className="swatches"><button className="swatch swatch--orange" type="button" aria-label="Оранжевый" aria-pressed={phoneTone === 'orange'} onClick={() => setPhoneTone('orange')} /><button className="swatch swatch--blue" type="button" aria-label="Синий" aria-pressed={phoneTone === 'blue'} onClick={() => setPhoneTone('blue')} /><button className="swatch swatch--silver" type="button" aria-label="Серебристый" aria-pressed={phoneTone === 'silver'} onClick={() => setPhoneTone('silver')} /></div>}</div>
          <div className="selector__stage" onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd}><div className="selector__halo" />{products.map((product) => <img key={product.key} className={`product-img selector__product ${selected === product.key ? 'is-active' : ''}`} src={product.image} alt={product.label} style={product.key === 'iphone' ? { filter: `${phoneFilter} drop-shadow(0 36px 42px rgba(0,0,0,.65))` } : undefined} />)}<div className="selector__meta">{products[selectedIndex]?.meta}<br />tap / swipe / select</div></div>
        </div>
      </section>

      <section className="final" id="final"><div className="section-shell final__grid"><h2 className="final__title">ВАШ<br />СЛЕДУЮЩИЙ?</h2><div className="final__side"><p>После визуальной истории остаётся одно действие. В production форма подключается к CRM, Telegram или WhatsApp.</p><form className="lead-form" onSubmit={submitLead}><input placeholder="Имя" name="name" /><input placeholder="Телефон / Telegram" name="phone" /><button className="btn btn--black" type="submit">Получить консультацию ↗</button><div className="lead-msg" aria-live="polite">{leadMessage}</div></form></div></div></section>

      <footer className="footer"><span>KINGSTORE — неофициальный redesign concept / UFA / 2026</span><span>Demo values, not a public offer.</span></footer>

      {tradeOpen && <div className="trade-modal" role="dialog" aria-modal="true" aria-label="Предварительная оценка Trade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) setTradeOpen(false); }}><div className="trade-modal__panel"><button type="button" className="trade-modal__close" onClick={() => setTradeOpen(false)} aria-label="Закрыть">×</button><div className="eyebrow">TRADE-IN / DEMO</div><h3>Предварительная оценка</h3><label>Ваш iPhone<select value={oldModel} onChange={(e) => setOldModel(Number(e.target.value))}>{oldModels.map((model) => <option value={model.value} key={model.name}>{model.name}</option>)}</select></label><label>Состояние<select value={condition} onChange={(e) => setCondition(Number(e.target.value))}>{conditions.map((item) => <option value={item.factor} key={item.name}>{item.name}</option>)}</select></label><div className="trade-modal__estimate"><span>Ориентировочно до</span><strong>{estimate.toLocaleString('ru-RU')} ₽</strong><small>Не является публичной офертой. Финальная стоимость определяется после диагностики.</small></div><button type="button" className="btn btn--yellow" onClick={() => { setTradeOpen(false); scrollTo('final'); }}>Продолжить ↗</button></div></div>}
    </main>
  );
}

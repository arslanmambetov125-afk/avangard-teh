"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type ProductKey = "iphone" | "mac" | "pods" | "watch";
type PhoneTone = "orange" | "blue" | "silver";

const PHONE_IMG = "https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro.png?width=1000";
const MAC_IMG = "https://commons.wikimedia.org/wiki/Special:Redirect/file/MacBook_Air_M4.svg?width=1200";
const PODS_IMG = "https://commons.wikimedia.org/wiki/Special:Redirect/file/AirPods_Pro_2.jpg?width=1200";
const WATCH_IMG = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Apple_Watch_Series_10.png?width=1000";
const STORE_IMG = "https://avatars.mds.yandex.net/get-altay/15181550/2a00000196d44d56ec0707067224eb35d743/XXL_height";

const products: Array<{ key: ProductKey; label: string; image: string; meta: string }> = [
  { key: "iphone", label: "iPhone 17 Pro", image: PHONE_IMG, meta: "PRO / 2025" },
  { key: "mac", label: "MacBook Air", image: MAC_IMG, meta: "AIR / M4" },
  { key: "pods", label: "AirPods Pro", image: PODS_IMG, meta: "AUDIO / PRO" },
  { key: "watch", label: "Apple Watch", image: WATCH_IMG, meta: "WATCH / SERIES 10" },
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

export default function KingstoreExperience() {
  const rootRef = useRef<HTMLElement | null>(null);
  const heroVisualRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<number | null>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
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

  const particles = useMemo(
    () =>
      Array.from({ length: 72 }, (_, index) => ({
        id: index,
        dx: 150 + ((index * 37) % 360),
        dy: -120 + ((index * 83) % 250),
        scale: 0.5 + ((index * 17) % 13) / 10,
      })),
    [],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !motionEnabled) {
      root.dataset.motion = "off";
      return;
    }

    root.dataset.motion = "on";
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const heroPhone = root.querySelector<HTMLElement>(".hero__phone");
      const hero = root.querySelector<HTMLElement>(".hero");
      const marquee = root.querySelector<HTMLElement>(".marquee__track");
      const heroVisual = heroVisualRef.current;

      if (hero && heroPhone) {
        gsap.to(heroPhone, {
          yPercent: 26,
          rotation: 3,
          scale: 0.86,
          opacity: 0.5,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: 0.7,
          },
        });
      }

      if (marquee) {
        gsap.to(marquee, {
          xPercent: -28,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.2,
          },
        });
      }

      if (heroVisual && heroPhone) {
        const xTo = gsap.quickTo(heroPhone, "x", { duration: 0.55, ease: "power3.out" });
        const yTo = gsap.quickTo(heroPhone, "y", { duration: 0.55, ease: "power3.out" });
        const rTo = gsap.quickTo(heroPhone, "rotation", { duration: 0.55, ease: "power3.out" });
        const move = (event: PointerEvent) => {
          const rect = heroVisual.getBoundingClientRect();
          const x = event.clientX - rect.left - rect.width / 2;
          const y = event.clientY - rect.top - rect.height / 2;
          xTo((x / rect.width) * 34);
          yTo((y / rect.height) * 22);
          rTo(-7 + (x / rect.width) * 8);
        };
        const leave = () => {
          xTo(0);
          yTo(0);
          rTo(-7);
        };
        heroVisual.addEventListener("pointermove", move);
        heroVisual.addEventListener("pointerleave", leave);
        ctx.add(() => {
          heroVisual.removeEventListener("pointermove", move);
          heroVisual.removeEventListener("pointerleave", leave);
        });
      }

      const story = root.querySelector<HTMLElement>("#product-story");
      const storyStage = story?.querySelector<HTMLElement>(".motion-stage");
      if (story && storyStage) {
        const storyTl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: story,
            start: "top top",
            end: "bottom bottom",
            pin: storyStage,
            pinSpacing: false,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        storyTl
          .to(".progress__bar--story", { width: "100%", ease: "none", duration: 1 }, 0)
          .to(".explode__base", { xPercent: -44, rotation: -7, scale: 0.91, duration: 0.46 }, 0.08)
          .to(".explode__camera", { xPercent: -185, yPercent: -58, rotation: -18, scale: 1.1, duration: 0.46 }, 0.08)
          .to(".explode__frame", { xPercent: 48, rotationY: 22, scale: 0.94, duration: 0.46 }, 0.08)
          .to(".explode__display", { xPercent: 126, rotationY: 35, scale: 0.9, duration: 0.46 }, 0.08)
          .to(".explode__chip", { xPercent: 45, yPercent: 150, rotation: 8, scale: 1.14, duration: 0.46 }, 0.08)
          .to(".tech-label", { opacity: 1, stagger: 0.045, duration: 0.16 }, 0.24)
          .to(".tech-label", { opacity: 0, stagger: 0.03, duration: 0.12 }, 0.68)
          .to([".explode__base", ".explode__camera", ".explode__frame", ".explode__display", ".explode__chip"], {
            xPercent: 0,
            yPercent: 0,
            rotation: 0,
            rotationY: 0,
            scale: 1,
            duration: 0.3,
            stagger: 0.018,
          }, 0.7);
      }

      const trade = root.querySelector<HTMLElement>("#trade-story");
      const tradeStage = trade?.querySelector<HTMLElement>(".motion-stage");
      if (trade && tradeStage) {
        const tradeTl = gsap.timeline({
          scrollTrigger: {
            trigger: trade,
            start: "top top",
            end: "bottom bottom",
            pin: tradeStage,
            pinSpacing: false,
            scrub: 1,
          },
        });
        tradeTl
          .to(".trade-old", { xPercent: -70, rotation: -13, scale: 0.78, opacity: 0.04, duration: 0.52, ease: "power2.in" }, 0.08)
          .to(".trade-beam", { scaleX: 1, duration: 0.28, ease: "power2.out" }, 0.13)
          .to(".particle", {
            opacity: 1,
            duration: 0.06,
            stagger: { each: 0.002, from: "random" },
          }, 0.17)
          .to(".particle", {
            x: (index: number) => particles[index]?.dx ?? 240,
            y: (index: number) => particles[index]?.dy ?? 0,
            scale: (index: number) => particles[index]?.scale ?? 1,
            opacity: 0,
            duration: 0.42,
            stagger: { each: 0.001, from: "random" },
            ease: "power2.out",
          }, 0.2)
          .fromTo(".trade-new", { xPercent: 80, rotation: 10, scale: 0.78, opacity: 0 }, { xPercent: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.28)
          .to(".trade-result", { opacity: 1, y: -8, duration: 0.2 }, 0.68);
      }

      const zero = root.querySelector<HTMLElement>("#zero-story");
      const zeroStage = zero?.querySelector<HTMLElement>(".motion-stage");
      if (zero && zeroStage) {
        const zeroTl = gsap.timeline({
          scrollTrigger: {
            trigger: zero,
            start: "top top",
            end: "bottom bottom",
            pin: zeroStage,
            pinSpacing: false,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        zeroTl
          .fromTo(".zero-phone", { x: () => -window.innerWidth * 0.46, rotation: -14, scale: 0.82 }, { x: () => window.innerWidth * 0.46, rotation: 11, scale: 1.04, duration: 1, ease: "none" }, 0)
          .fromTo(".zero-number", { scale: 0.83, opacity: 0.36 }, { scale: 1.05, opacity: 0.94, duration: 0.5, ease: "power2.out" }, 0)
          .to(".zero-number", { scale: 0.92, opacity: 0.64, duration: 0.5 }, 0.5);
      }

      const city = root.querySelector<HTMLElement>(".city");
      if (city) {
        gsap.fromTo(".city__photo img", { scale: 1.1, yPercent: -2 }, {
          scale: 1.01,
          yPercent: 2,
          ease: "none",
          scrollTrigger: { trigger: city, start: "top bottom", end: "bottom top", scrub: 1 },
        });
        gsap.from(".address", {
          y: 18,
          opacity: 0,
          stagger: 0.07,
          duration: 0.55,
          ease: "power2.out",
          scrollTrigger: { trigger: ".city__addresses", start: "top 78%" },
        });
      }

      const final = root.querySelector<HTMLElement>(".final");
      if (final) {
        gsap.from(".final__title", {
          yPercent: 25,
          opacity: 0,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: final, start: "top 72%" },
        });
      }
    }, root);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [motionEnabled, particles]);

  useLayoutEffect(() => {
    if (!tradeOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTradeOpen(false);
    };
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

  function onSwipeStart(event: ReactPointerEvent<HTMLDivElement>) {
    swipeStartRef.current = event.clientX;
  }

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

  const phoneFilter =
    phoneTone === "orange"
      ? "saturate(.9) contrast(1.04)"
      : phoneTone === "blue"
        ? "hue-rotate(148deg) saturate(.72) brightness(.84) contrast(1.1)"
        : "grayscale(1) brightness(1.15) contrast(.94)";

  return (
    <main className="ks-site" ref={rootRef}>
      <nav className="ks-nav" aria-label="Основная навигация">
        <button className="ks-logo" type="button" onClick={() => scrollTo("home")} aria-label="KINGSTORE — наверх">
          <strong>KING</strong>STORE
        </button>
        <div className="ks-nav__right">
          <span className="ks-nav__meta">UFA · NON-OFFICIAL DIGITAL CONCEPT</span>
          <button
            className="ks-nav__motion"
            type="button"
            aria-pressed={motionEnabled}
            onClick={() => setMotionEnabled((value) => !value)}
          >
            Motion {motionEnabled ? "on" : "off"}
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
          <div className="hero__visual" ref={heroVisualRef} aria-label="Интерактивная сцена iPhone">
            <div className="hero__glow" aria-hidden="true" />
            <div className="hero__orb" aria-hidden="true" />
            <img className="product-img hero__phone" src={PHONE_IMG} alt="iPhone 17 Pro, Cosmic Orange" fetchPriority="high" decoding="async" />
            <span className="hero__hint">двигайте курсор →</span>
          </div>
        </div>
        <div className="hero__scroll">scroll to enter / 01</div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          <span>KINGSTORE</span><span>iPhone</span><span>Trade‑in</span><span>0% до 24 месяцев</span><span>UFA</span><span>Motion first</span><span>KINGSTORE</span><span>iPhone</span><span>Trade‑in</span><span>UFA</span>
        </div>
      </div>

      <section className="motion-section" id="product-story">
        <div className="motion-stage">
          <div className="section-shell motion-stage__grid">
            <div className="motion-copy">
              <div className="eyebrow">01 / PRODUCT STORY</div>
              <h2 className="motion-title">PRO.<br /><span className="yellow">ПО СЛОЯМ.</span></h2>
              <p className="motion-desc">Прокрутка становится режиссурой: камера, корпус, дисплей и A19 Pro расходятся по глубине, а затем снова собираются в цельный продукт.</p>
              <div className="progress"><div className="progress__bar progress__bar--story" /></div>
            </div>
            <div className="explode" aria-label="Exploded-view сцена iPhone 17 Pro">
              <div className="explode__display" aria-hidden="true" />
              <div className="explode__frame" aria-hidden="true" />
              <div className="explode__chip" aria-label="A19 Pro">A19<br />PRO</div>
              <img className="product-img explode__base" src={PHONE_IMG} alt="iPhone 17 Pro" loading="lazy" decoding="async" />
              <div className="explode__camera" aria-hidden="true"><span className="lens" /><span className="lens" /><span className="lens" /></div>
              <span className="tech-label tech-label--1">48 MP Fusion Camera</span>
              <span className="tech-label tech-label--2">Aluminum unibody</span>
              <span className="tech-label tech-label--3">A19 Pro</span>
              <span className="tech-label tech-label--4">Super Retina XDR</span>
            </div>
          </div>
        </div>
      </section>

      <section className="motion-section" id="trade-story">
        <div className="motion-stage">
          <div className="section-shell motion-stage__grid">
            <div className="motion-copy">
              <div className="eyebrow">02 / TRADE‑IN</div>
              <h2 className="motion-title">TRADE<br /><span className="yellow">UP.</span></h2>
              <p className="motion-desc">Старый смартфон распадается на жёлтый световой поток, а новый iPhone появляется из него. Коммерческое предложение становится частью motion‑сцены.</p>
              <button type="button" className="btn btn--yellow trade-cta" onClick={() => setTradeOpen(true)}>Оценить устройство ↗</button>
            </div>
            <div className="trade-space" aria-label="Анимация Trade-in">
              <div className="trade-old" aria-label="Старый iPhone"><div className="trade-old__camera" /></div>
              <div className="trade-beam" aria-hidden="true" />
              <div className="particles" aria-hidden="true">
                {particles.map((particle) => <span className="particle" key={particle.id} />)}
              </div>
              <img className="product-img trade-new" src={PHONE_IMG} alt="Новый iPhone 17 Pro" loading="lazy" decoding="async" />
              <div className="trade-result"><small>предварительная оценка до</small><strong>65 000 ₽</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="motion-section" id="zero-story">
        <div className="motion-stage">
          <div className="section-shell motion-stage__grid">
            <div className="motion-copy">
              <div className="eyebrow">03 / INSTALLMENT</div>
              <h2 className="motion-title">БОЛЬШОЙ<br /><span className="yellow">0%.</span></h2>
              <p className="motion-desc">Ноль — не подпись, а объект сцены. iPhone проходит через него при скролле, после чего пользователь может проверить пример платежа.</p>
              <div className="finance-ui">
                <div className="finance-ui__label"><span>Срок</span><strong>{months} мес.</strong></div>
                <input aria-label="Срок рассрочки" type="range" min="6" max="24" step="6" value={months} onChange={(event) => setMonths(Number(event.target.value))} />
                <div className="finance-ui__ticks"><span>6</span><span>12</span><span>18</span><span>24</span></div>
                <div className="finance-ui__payment">≈ <span>{payment.toLocaleString("ru-RU")} ₽</span> / мес.*</div>
              </div>
            </div>
            <div className="zero-space">
              <div className="zero-number" aria-hidden="true">0</div>
              <img className="product-img zero-phone" src={PHONE_IMG} alt="iPhone 17 Pro" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </section>

      <section className="city" id="ufa">
        <div className="city__photo" aria-hidden="true"><img src={STORE_IMG} alt="" loading="lazy" decoding="async" /></div>
        <div className="section-shell city__inner">
          <div>
            <div className="eyebrow">04 / KINGSTORE / UFA</div>
            <div className="city__word"><span className="yellow">KING</span><br />В ГОРОДЕ.</div>
            <div className="city__badge">точки KINGSTORE в Уфе</div>
          </div>
          <div className="city__addresses" aria-label="Адреса KINGSTORE в Уфе">
            {stores.map(([address, hours]) => <div className="address" key={address}><strong>{address}</strong>{hours}</div>)}
          </div>
        </div>
      </section>

      <section className="selector" id="devices">
        <div className="section-shell selector__grid">
          <div>
            <div className="eyebrow">05 / CHOOSE YOURS</div>
            <h2 className="motion-title">ОДИН<br /><span className="yellow">ОБЪЕКТ.</span></h2>
            <p className="motion-desc">Никакой стены из карточек. На экране живёт только один продукт — и плавно уступает место следующему.</p>
            <div className="selector__menu" aria-label="Выбор устройства">
              {products.map((product) => (
                <button key={product.key} type="button" className="product-tab" aria-pressed={selected === product.key} onClick={() => setSelected(product.key)}>{product.label}</button>
              ))}
            </div>
            {selected === "iphone" && (
              <div className="swatches" aria-label="Цвет iPhone">
                <button type="button" className="swatch swatch--orange" aria-label="Cosmic Orange" aria-pressed={phoneTone === "orange"} onClick={() => setPhoneTone("orange")} />
                <button type="button" className="swatch swatch--blue" aria-label="Deep Blue" aria-pressed={phoneTone === "blue"} onClick={() => setPhoneTone("blue")} />
                <button type="button" className="swatch swatch--silver" aria-label="Silver" aria-pressed={phoneTone === "silver"} onClick={() => setPhoneTone("silver")} />
              </div>
            )}
          </div>
          <div className="selector__stage" onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd} aria-label="Выбранное устройство. На мобильном можно свайпнуть.">
            <div className="selector__halo" aria-hidden="true" />
            {products.map((product) => (
              <img
                key={product.key}
                className={`product-img selector__product ${selected === product.key ? "is-active" : ""}`}
                src={product.image}
                alt={product.label}
                loading="lazy"
                decoding="async"
                style={product.key === "iphone" ? { filter: `${phoneFilter} drop-shadow(0 36px 42px rgba(0,0,0,.65))` } : undefined}
              />
            ))}
            <div className="selector__meta">{products[selectedIndex]?.meta}<br />tap / swipe / select</div>
          </div>
        </div>
      </section>

      <section className="final" id="final">
        <div className="section-shell final__grid">
          <h2 className="final__title">ВАШ<br />СЛЕДУЮЩИЙ?</h2>
          <div className="final__side">
            <p>После визуальной истории остаётся одно действие. В production форма подключается к CRM, Telegram или WhatsApp.</p>
            <form className="lead-form" onSubmit={submitLead} noValidate>
              <input aria-label="Имя" name="name" placeholder="Имя" autoComplete="name" />
              <input aria-label="Телефон или Telegram" name="phone" placeholder="Телефон / Telegram" autoComplete="tel" inputMode="tel" />
              <button className="btn btn--black" type="submit">Получить консультацию ↗</button>
              <div className="lead-msg" aria-live="polite">{leadMessage}</div>
            </form>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>KINGSTORE — неофициальный redesign concept / UFA / 2026</span>
        <span>Product visuals: Wikimedia Commons · Store reference: Yandex Maps · Prices and estimates are demo values, not a public offer.</span>
      </footer>

      {tradeOpen && (
        <div className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setTradeOpen(false); }}>
          <div className="trade-modal__panel">
            <div className="trade-modal__head"><h3 id="trade-title">Предварительная оценка</h3><button className="close-btn" type="button" aria-label="Закрыть" onClick={() => setTradeOpen(false)}>×</button></div>
            <label className="field">Ваш iPhone<select value={oldModel} onChange={(event) => setOldModel(Number(event.target.value))}>{oldModels.map((model) => <option value={model.value} key={model.name}>{model.name}</option>)}</select></label>
            <label className="field">Состояние<select value={condition} onChange={(event) => setCondition(Number(event.target.value))}>{conditions.map((item) => <option value={item.factor} key={item.name}>{item.name}</option>)}</select></label>
            <div className="trade-modal__value"><small>примерная стоимость до</small><strong>{estimate.toLocaleString("ru-RU")} ₽</strong></div>
            <p className="trade-modal__note">Демо-расчёт для концепта. Финальная стоимость Trade‑in определяется KINGSTORE после диагностики устройства.</p>
            <button className="btn btn--yellow" type="button" onClick={() => { setTradeOpen(false); scrollTo("final"); }}>Продолжить →</button>
          </div>
        </div>
      )}
    </main>
  );
}

(() => {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  const form = document.querySelector("#inquiry-form");
  const statusEl = document.querySelector("[data-form-status]");
  const yearEl = document.querySelector("[data-year]");

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toggle && header && mobileNav) {
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      mobileNav.hidden = !open;
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        header.classList.remove("is-open");
        mobileNav.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "메뉴 열기");
      });
    });
  }

  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  const slider = document.querySelector("[data-slider]");
  if (slider) {
    const track = slider.querySelector("[data-slider-track]");
    const slides = [...slider.querySelectorAll("[data-slide]")];
    const dotsWrap = slider.querySelector("[data-slider-dots]");
    const prevBtn = slider.querySelector("[data-slider-prev]");
    const nextBtn = slider.querySelector("[data-slider-next]");
    const caption = slider.querySelector("[data-slider-caption]");
    const captionTag = caption?.querySelector("[data-caption-tag]");
    const captionLabel = caption?.querySelector("[data-caption-label]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let index = 0;
    let timer = null;

    const syncCaption = (slide) => {
      if (!slide || !caption) return;
      if (captionTag) captionTag.textContent = slide.dataset.captionTag || "";
      if (captionLabel) captionLabel.textContent = slide.dataset.captionLabel || "";
    };

    const go = (next) => {
      index = (next + slides.length) % slides.length;
      if (track) track.style.transform = `translateX(-${index * 100}%)`;
      slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
      syncCaption(slides[index]);
      dotsWrap?.querySelectorAll(".slider-dot").forEach((dot, i) => {
        dot.classList.toggle("is-active", i === index);
        dot.setAttribute("aria-selected", i === index ? "true" : "false");
      });
    };

    slides.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `slider-dot${i === 0 ? " is-active" : ""}`;
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `${i + 1}번째 샘플`);
      dot.setAttribute("aria-selected", i === 0 ? "true" : "false");
      dot.addEventListener("click", () => {
        go(i);
        restart();
      });
      dotsWrap?.appendChild(dot);
    });

    prevBtn?.addEventListener("click", () => {
      go(index - 1);
      restart();
    });
    nextBtn?.addEventListener("click", () => {
      go(index + 1);
      restart();
    });

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (reduceMotion || slides.length < 2) return;
      stop();
      timer = setInterval(() => go(index + 1), 4500);
    };
    const restart = () => {
      stop();
      start();
    };

    slider.addEventListener("pointerenter", stop);
    slider.addEventListener("pointerleave", start);
    go(0);
    start();
  }

  const setStatus = (msg, type) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.remove("is-ok", "is-err");
    if (type) statusEl.classList.add(type);
  };

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("");

      if (!form.checkValidity()) {
        form.reportValidity();
        setStatus("필수 항목을 확인해 주세요.", "is-err");
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      const apiBase = (window.SIGNET_CONFIG && window.SIGNET_CONFIG.apiBaseUrl) || "";

      form.classList.add("is-loading");
      try {
        const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/inquiry`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.message || "문의 접수에 실패했습니다.");
        }

        form.reset();
        setStatus("문의가 접수되었습니다. 빠르게 연락드리겠습니다.", "is-ok");
      } catch (err) {
        setStatus(err.message || "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "is-err");
      } finally {
        form.classList.remove("is-loading");
      }
    });
  }
})();

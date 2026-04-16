document.addEventListener('DOMContentLoaded', function () {
  const productGridItems = document.querySelectorAll('.product-grid__item');

  productGridItems.forEach((item) => {
    const button = item.querySelector('.product-grid__icon');
    const productId = item.getAttribute('data-product-id');
    const modal = document.querySelector(`.product-modal[data-product-id="${productId}"]`);

    if (!button || !modal) return;

    // ─── Open modal ───────────────────────────────────────────────
    button.addEventListener('click', () => {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      resetModalState(modal);
    });

    // ─── Close modal ──────────────────────────────────────────────
    const closeButton = modal.querySelector('.modal-close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => closeModal(modal));
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });

    // ─── Variant selection ────────────────────────────────────────
    setupVariantSelection(modal, productId);

    // ─── Add to Cart ──────────────────────────────────────────────
    const addToCartBtn = modal.querySelector('.add-to-cart');
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', () => handleAddToCart(modal, addToCartBtn));
    }
  });
});

// ─── Close helper ──────────────────────────────────────────────────────────────
function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Reset state when reopening ────────────────────────────────────────────────
function resetModalState(modal) {
  clearError(modal);
  modal.querySelectorAll('.variant-button').forEach((btn) => btn.classList.remove('selected'));
  const select = modal.querySelector('.variant-select');
  if (select) select.value = '';
  const addBtn = modal.querySelector('.add-to-cart');
  if (addBtn) {
    addBtn.disabled = false;
    addBtn.classList.remove('loading', 'success');
    addBtn.innerHTML = `Add to Cart <span class="icon-arrow">${addBtn.querySelector('.icon-arrow')?.innerHTML || ''}</span>`;
  }
}

// ─── Wire up color buttons + size select ───────────────────────────────────────
function setupVariantSelection(modal, productId) {
  const colorButtons = modal.querySelectorAll('.variant-button[data-option-name="Color"]');
  const sizeSelect = modal.querySelector('.variant-select[data-option-name="Size"]');

  colorButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      colorButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      clearError(modal);
      updateSelectedVariant(modal, productId);
    });
  });

  if (sizeSelect) {
    sizeSelect.addEventListener('change', () => {
      clearError(modal);
      updateSelectedVariant(modal, productId);
    });
  }
}

// ─── Match selected color + size → variant id ─────────────────────────────────
function updateSelectedVariant(modal, productId) {
  const selectedColorBtn = modal.querySelector('.variant-button[data-option-name="Color"].selected');
  const sizeSelect = modal.querySelector('.variant-select[data-option-name="Size"]');

  const selectedColor = selectedColorBtn?.getAttribute('data-option-value') || null;
  const selectedSize = sizeSelect?.value || null;

  if (!selectedColor || !selectedSize) {
    modal.dataset.selectedVariantId = '';
    return;
  }

  // Fetch variants from window.productVariants (populated per product below)
  const variants = getProductVariants(productId);
  if (!variants) return;

  const match = variants.find((v) => {
    const options = [v.option1, v.option2, v.option3];
    return options.includes(selectedColor) && options.includes(selectedSize);
  });

  if (match) {
    modal.dataset.selectedVariantId = match.id;
    // Update price display if variant has a different price
    const priceEl = modal.querySelector('.modal-product-price');
    if (priceEl && match.price) {
      priceEl.textContent = formatMoney(match.price);
    }
  } else {
    modal.dataset.selectedVariantId = '';
    showError(modal, 'This combination is unavailable.');
  }
}

// ─── Add to cart ───────────────────────────────────────────────────────────────
async function handleAddToCart(modal, addToCartBtn) {
  clearError(modal);

  const selectedColorBtn = modal.querySelector('.variant-button[data-option-name="Color"].selected');
  const sizeSelect = modal.querySelector('.variant-select[data-option-name="Size"]');
  const selectedSize = sizeSelect?.value;

  // Validate selections
  if (!selectedColorBtn) {
    showError(modal, 'Please select a color.');
    return;
  }
  if (!selectedSize) {
    showError(modal, 'Please select a size.');
    return;
  }

  const variantId = modal.dataset.selectedVariantId;
  if (!variantId) {
    showError(modal, 'This combination is unavailable. Please choose another.');
    return;
  }

  const quantity = parseInt(modal.querySelector('.quantity-input')?.value || '1', 10);

  // Loading state
  addToCartBtn.disabled = true;
  addToCartBtn.classList.add('loading');
  addToCartBtn.innerHTML = `<span class="btn-spinner"></span> Adding…`;

  try {
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.description || 'Could not add to cart.');
    }

    // Success state
    addToCartBtn.classList.remove('loading');
    addToCartBtn.classList.add('success');
    addToCartBtn.innerHTML = `✓ Added to Cart`;

    // Refresh cart (works with Dawn and most themes)
    document.dispatchEvent(new CustomEvent('cart:refresh'));
    // Also trigger cart drawer if present
    fetch('/cart.js')
      .then((r) => r.json())
      .then((cart) => {
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
      });

    // With this:
    setTimeout(() => {
        resetModalState(modal);
        closeModal(modal);
        window.location.href = '/cart';
    }, 1400);
  } catch (err) {
    addToCartBtn.disabled = false;
    addToCartBtn.classList.remove('loading');
    addToCartBtn.innerHTML = `Add to Cart`;
    showError(modal, err.message);
  }
}

// ─── Error helpers ─────────────────────────────────────────────────────────────
function showError(modal, message) {
  let errorEl = modal.querySelector('.variant-error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.className = 'variant-error';
    const variantSection = modal.querySelector('.product-variant');
    variantSection?.appendChild(errorEl);
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function clearError(modal) {
  const errorEl = modal.querySelector('.variant-error');
  if (errorEl) errorEl.style.display = 'none';
}

// ─── Variant data access ───────────────────────────────────────────────────────
// window.productVariantsMap must be populated from Liquid (see snippet below)
function getProductVariants(productId) {
  return window.productVariantsMap?.[productId] || null;
}

// ─── Money formatter (mirrors Shopify: cents → formatted) ─────────────────────
function formatMoney(cents) {
  return new Intl.NumberFormat('en', { style: 'currency', currency: window.Shopify?.currency?.active || 'USD' }).format(cents / 100);
}
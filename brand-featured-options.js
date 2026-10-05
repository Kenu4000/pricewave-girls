(() => {
  const FEATURED_LIMIT = 20;
  const FEATURED_EXCLUDED_SOURCE_KEYS = new Set(['BEEP', 'AiNO'].map(normalizeBrandKey));
  const FEATURED_PINNED_BRANDS = ['暁', 'あっぷりけ', 'パープルソフトウェア', 'Navel', 'ぱれっと'];
  const BRAND_ALIAS_GROUPS = [
    ['ALICESOFT', 'ALICESOFT（アリスソフト）', 'ALICESOFT', 'AliceSoft', 'アリスソフト', 'ありすそふと'],
    ['戯画', '戯画（GIGA）', '戯画', 'GIGA', 'Giga'],
    ['FrontWing', 'FrontWing（フロントウィング）', 'FrontWing', 'フロントウィング', 'フロントウイング'],
    ['NitroPlus', 'NitroPlus（ニトロプラス）', 'NitroPlus', 'Nitro+', 'ニトロプラス'],
    ['Purple software', 'Purple software（パープルソフトウェア）', 'Purple software', 'パープルソフトウェア'],
    ['ぱれっと', 'ぱれっと', 'ぱれっと', 'パレット', 'Palette', 'PALETTE'],
    ['Leaf', 'Leaf', 'Leaf', 'LEAF', 'リーフ', 'AQUAPLUS', 'AQUAPLUS（アクアプラス）', 'アクアプラス'],
    ['あかべぇそふとつぅ', 'あかべぇそふとつぅ', 'あかべぇそふとつぅ', 'AKABEi SOFT2', 'AKABEiSOFT2', 'AiNO', 'AINO'],
    ['Liar-soft', 'Liar-soft（ライアーソフト）', 'Liar-soft', 'ライアーソフト'],
    ['Escu:de', 'Escu:de（エスクード）', 'Escu:de', 'エスクード'],
    ['Overflow', 'Overflow（オーバーフロー）', 'Overflow', 'オーバーフロー'],
    ['BLUE GALE', 'BLUE GALE（ブルーゲイル）', 'BLUE GALE', 'ブルーゲイル'],
    ['FlyingShine', 'FlyingShine（フライングシャイン）', 'FlyingShine', 'フライングシャイン'],
    ['UNiSONSHIFT', 'UNiSONSHIFT（ユニゾンシフト）', 'UNiSONSHIFT', 'ユニゾンシフト'],
    ['MAGES.', 'MAGES.（5pb.）', 'MAGES.', 'MAGES.(5pb.)', '5pb.', '5pb'],
    ['CandySoft', 'CandySoft（きゃんでぃそふと）', 'CandySoft', 'きゃんでぃそふと'],
    ['D.O.', 'D.O.（ディーオー）', 'D.O.', 'ディーオー'],
    ['HOOKSOFT', 'HOOKSOFT（HOOK）', 'HOOKSOFT', 'HOOK'],
    ['âge', 'âge（age）', 'âge', 'age', 'aNTIQ', 'ANTIQ'],
    ['F&C', 'F&C', 'F&C・FC01', 'F&C･FC01', 'FC01', 'F&C・FC02', 'F&C･FC02', 'FC02', 'COCKTAIL SOFT', 'カクテルソフト', 'カクテル・ソフト', 'FAIRYTALE', 'フェアリーテール', 'FAIRYTALE ETHIX', 'HARDCOVER'],
    ['Littlewitch', 'Littlewitch（リトルウィッチ）', 'Littlewitch', 'リトルウィッチ', 'リトルウイッチ', 'Littlewitch velvet', 'リトルウィッチ velvet', 'リトルウィッチ・ベルベット', 'リトルウィッチベルベット'],
    ['feng', 'feng（フォン）', 'feng', 'フォン', 'ふぉん'],
  ];
  const app = document.querySelector('#app');
  const runtime = globalThis.PricewaveViewerEnhancements;
  if (!app || typeof runtime?.register !== 'function') return;

  const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
  const aliasIndex = new Map();
  let applying = false;

  function cleanBrandLabel(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/^(?:ブランド|メーカー)\s*[:：]\s*/u, '')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  function normalizeBrandKey(value) {
    return cleanBrandLabel(value)
      .toLocaleLowerCase('ja')
      .replace(/[\s\p{P}\p{S}]/gu, '');
  }

  for (const [keyLabel, displayLabel, ...aliases] of BRAND_ALIAS_GROUPS) {
    const key = normalizeBrandKey(keyLabel);
    const identity = { key, label: displayLabel };
    for (const alias of [keyLabel, displayLabel, ...aliases]) {
      aliasIndex.set(normalizeBrandKey(alias), identity);
    }
  }

  function resolveBrandIdentity(value) {
    const label = cleanBrandLabel(value);
    const normalized = normalizeBrandKey(label);
    return aliasIndex.get(normalized) || { key: normalized, label };
  }

  function compareRatioDescending(leftNumerator, leftDenominator, rightNumerator, rightDenominator) {
    return rightNumerator * leftDenominator - leftNumerator * rightDenominator;
  }

  function compareProfiles(left, right) {
    return (
      compareRatioDescending(left.withinThreeDays, left.total, right.withinThreeDays, right.total) ||
      compareRatioDescending(left.daily, left.total, right.daily, right.total) ||
      compareRatioDescending(left.withinSevenDays, left.total, right.withinSevenDays, right.total) ||
      compareRatioDescending(left.active, left.total, right.active, right.total) ||
      right.total - left.total ||
      collator.compare(left.label, right.label)
    );
  }

  function buildProfiles(products, excludeFeaturedSources = false) {
    const profiles = new Map();
    for (const product of products || []) {
      const rawBrand = String(product.manufacturer || '').trim();
      if (!rawBrand) continue;
      if (excludeFeaturedSources && FEATURED_EXCLUDED_SOURCE_KEYS.has(normalizeBrandKey(rawBrand))) continue;
      const identity = resolveBrandIdentity(rawBrand);
      if (!identity.key) continue;
      const profile = profiles.get(identity.key) || {
        value: identity.key,
        label: identity.label,
        total: 0,
        daily: 0,
        withinThreeDays: 0,
        withinSevenDays: 0,
        active: 0,
      };
      profile.total += 1;
      if (product.crawlIntervalDays === 1) {
        profile.daily += 1;
        profile.withinThreeDays += 1;
        profile.withinSevenDays += 1;
        profile.active += 1;
      } else if (product.crawlIntervalDays === 3) {
        profile.withinThreeDays += 1;
        profile.withinSevenDays += 1;
        profile.active += 1;
      } else if (product.crawlIntervalDays === 7) {
        profile.withinSevenDays += 1;
        profile.active += 1;
      } else if (product.crawlIntervalDays === 14) {
        profile.active += 1;
      }
      profiles.set(identity.key, profile);
    }
    return profiles;
  }

  function mainBrandGroups(products) {
    const allProfiles = buildProfiles(products);
    const eligibleProfiles = buildProfiles(products, true);
    const stoppedKeys = new Set(
      [...allProfiles.values()].filter((profile) => profile.active === 0).map((profile) => profile.value),
    );

    const automatic = [...eligibleProfiles.values()]
      .filter((profile) => profile.total >= 2)
      .sort(compareProfiles)
      .slice(0, FEATURED_LIMIT);
    const selected = new Set(automatic.map((profile) => profile.value));
    const pinned = FEATURED_PINNED_BRANDS.flatMap((brand) => {
      const profile = eligibleProfiles.get(resolveBrandIdentity(brand).key);
      return profile && !selected.has(profile.value) ? [profile] : [];
    });

    return {
      featured: [...automatic, ...pinned]
        .filter((profile) => !stoppedKeys.has(profile.value))
        .sort((left, right) => collator.compare(left.label, right.label)),
      byProductCount: [...allProfiles.values()]
        .filter((profile) => profile.active > 0)
        .sort((left, right) => right.total - left.total || collator.compare(left.label, right.label)),
      stopped: [...allProfiles.values()]
        .filter((profile) => profile.active === 0)
        .sort((left, right) => collator.compare(left.label, right.label)),
    };
  }

  function canonicalOptions(select) {
    const byKey = new Map();
    for (const option of select.querySelectorAll('option')) {
      if (!option.value) continue;
      const rawLabel = option.textContent?.trim() || option.value;
      const identity = resolveBrandIdentity(rawLabel);
      if (!identity.key) continue;
      const current = byKey.get(identity.key);
      const candidate = { key: identity.key, value: option.value, label: identity.label };
      if (!current || normalizeBrandKey(rawLabel) === identity.key) byKey.set(identity.key, candidate);
    }
    return byKey;
  }

  function optionFromProfile(profile, optionMap) {
    const option = optionMap.get(profile.value);
    return option ? { ...option, label: profile.label } : null;
  }

  function appendGroup(nodes, label, values) {
    if (!values.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    for (const source of values) {
      const option = document.createElement('option');
      option.value = source.value;
      option.textContent = source.label;
      group.append(option);
    }
    nodes.push(group);
  }

  function ensureProductCountField(brandSelect, values, selectedKey) {
    const brandField = brandSelect.closest('label.filter-field');
    if (!brandField) return;
    let field = brandField.parentElement?.querySelector('label[data-viewer-product-count-brand-field="true"]');
    if (!field) {
      field = document.createElement('label');
      field.className = 'filter-field';
      field.dataset.viewerProductCountBrandField = 'true';
      const label = document.createElement('span');
      label.textContent = '製品数が多い順';
      const select = document.createElement('select');
      select.className = 'select';
      select.id = 'brand-product-count';
      field.append(label, select);
      brandField.insertAdjacentElement('afterend', field);
    }

    const countSelect = field.querySelector('#brand-product-count');
    if (!(countSelect instanceof HTMLSelectElement)) return;
    const countSignature = values
      .map((source) => `${source.key}\u0000${source.value}\u0000${source.label}`)
      .join('\u0001');
    if (countSelect.dataset.mainBrandCountOrder !== countSignature) {
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'すべて';
      const options = values.map((source) => {
        const option = document.createElement('option');
        option.value = source.value;
        option.textContent = source.label;
        option.dataset.brandKey = source.key;
        return option;
      });
      countSelect.replaceChildren(blank, ...options);
      countSelect.dataset.mainBrandCountOrder = countSignature;
    }
    const selected = values.find((source) => source.key === selectedKey);
    countSelect.value = selected?.value || '';

    countSelect.onchange = () => {
      const chosen = countSelect.selectedOptions[0];
      const key = chosen?.dataset.brandKey || '';
      const target = [...brandSelect.options].find((option) => option.dataset.brandKey === key);
      brandSelect.value = target?.value || '';
    };
    brandSelect.onchange = () => {
      const key = brandSelect.selectedOptions[0]?.dataset.brandKey || '';
      const target = [...countSelect.options].find((option) => option.dataset.brandKey === key);
      countSelect.value = target?.value || '';
    };
  }

  const productsPromise = fetch('./data/index.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => Array.isArray(data?.products) ? data.products : [])
    .catch(() => []);

  async function applyBrandOptions() {
    if (applying) return;
    const select = document.querySelector('#brand');
    if (!(select instanceof HTMLSelectElement)) return;

    const selectedLabel = select.selectedOptions[0]?.textContent?.trim() || state.brand || '';
    const selectedKey = selectedLabel ? resolveBrandIdentity(selectedLabel).key : '';
    const blankLabel = [...select.options].find((option) => option.value === '')?.textContent?.trim() || 'すべて';
    const optionMap = canonicalOptions(select);
    if (!optionMap.size) return;

    const products = await productsPromise;
    const groups = mainBrandGroups(products);
    const stopped = groups.stopped.map((profile) => optionFromProfile(profile, optionMap)).filter(Boolean);
    const stoppedSet = new Set(stopped.map((option) => option.key));
    const featured = groups.featured.map((profile) => optionFromProfile(profile, optionMap)).filter(Boolean);
    const alphabetical = [...optionMap.values()]
      .filter((option) => !stoppedSet.has(option.key))
      .sort((left, right) => collator.compare(left.label, right.label));
    const byProductCount = groups.byProductCount
      .map((profile) => optionFromProfile(profile, optionMap))
      .filter(Boolean);

    const signature = [
      featured.map((option) => option.key).join('\u0000'),
      alphabetical.map((option) => option.key).join('\u0000'),
      stopped.map((option) => option.key).join('\u0000'),
      byProductCount.map((option) => option.key).join('\u0000'),
    ].join('\u0001');
    if (select.dataset.mainBrandOrder === signature) {
      ensureProductCountField(select, byProductCount, selectedKey);
      return;
    }

    applying = true;
    try {
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = blankLabel;
      const nodes = [blank];
      appendGroup(nodes, 'よく登録されているメーカー', featured);
      appendGroup(nodes, '五十音順', alphabetical);
      appendGroup(nodes, '巡回停止', stopped);
      select.replaceChildren(...nodes);
      for (const option of select.querySelectorAll('option')) {
        if (!option.value) continue;
        const match = [...featured, ...alphabetical, ...stopped].find((source) => source.value === option.value);
        if (match) option.dataset.brandKey = match.key;
      }
      const selected = [...featured, ...alphabetical, ...stopped].find((source) => source.key === selectedKey);
      select.value = selected?.value || '';
      select.dataset.mainBrandOrder = signature;
      ensureProductCountField(select, byProductCount, selectedKey);
    } finally {
      applying = false;
    }
  }

  const originalFilteredProducts = globalThis.filteredProducts;
  if (typeof originalFilteredProducts === 'function') {
    globalThis.filteredProducts = function filteredProductsWithMainBrandAliases(source = state.data.products) {
      const selectedBrand = state.brand;
      if (!selectedBrand) return originalFilteredProducts(source);
      const selectedKey = resolveBrandIdentity(selectedBrand).key;
      state.brand = '';
      try {
        return originalFilteredProducts(source).filter(
          (product) => resolveBrandIdentity(product.manufacturer).key === selectedKey,
        );
      } finally {
        state.brand = selectedBrand;
      }
    };
  }

  runtime.register('brand-featured-options', applyBrandOptions);
})();
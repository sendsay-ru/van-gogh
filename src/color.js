const { colord, extend } = require('colord');
const minifyPlugin = require('colord/plugins/minify');
const labPlugin = require('colord/plugins/lab');
const baseColors = require('../config/base.json');
const { cache } = require('./cache');

extend([minifyPlugin, labPlugin]);

const toHex = (color) =>
  colord(colord(color).toHex()).minify({ alphaHex: true });
const toHexWithoutAlpha = (color) =>
  colord(colord(color).alpha(1).toHex()).minify({ alphaHex: true });

const getExistsColor = (color) =>
  cache.find(({ hex }) => colord(color).isEqual(hex));

const getResult = (info) => {
  if (info.alpha?.opacity === 0) {
    return {
      value: 'transparent',
    };
  }

  if (!info.replaceable) {
    return {
      value: info.hex,
    };
  }

  const sibling = info.siblings[0];

  if (!sibling.var) {
    return {
      value: sibling.hex,
    };
  }

  if (!info.alpha) {
    return {
      hex: sibling.hex,
      value: `var(${sibling.var})`,
      var: sibling.var,
    };
  }

  return {
    hex: info.hex,
    value: `var(${sibling.var}-a-${info.alpha.opacity * 100})`,
    var: `${sibling.var}-a-${info.alpha.opacity * 100}`,
    order: `${sibling.var}-${info.alpha.opacity}`,
    opacity: info.alpha.opacity,
  };
};

const getSiblings = (color, { config, palette }) => {
  const siblings = palette.map(({ code, group, name, ...sibling }) => {
    const delta = colord(toHexWithoutAlpha(color)).delta(sibling.hex);

    const result = {
      name: name || code || '',
      group: group || 'base',
      hex: sibling.hex,
      delta,
    };

    if (config.vars && sibling.var) {
      result.var = sibling.var;
    }

    return result;
  });

  siblings.sort((a, b) => a.delta - b.delta);

  return siblings.slice(0, config.number);
};

const getColor = (draftColor, { palette, config, file }) => {
  let color = draftColor;

  if (baseColors[color]) {
    color = baseColors[color];
  }

  if (!colord(color).isValid()) {
    return null;
  }

  const hex = toHex(color);

  const alpha = colord(hex).alpha();
  const isAlpha = alpha !== 1;

  const existsColor = getExistsColor(hex);

  if (existsColor) {
    if (file && !existsColor.files.includes(file)) {
      existsColor.files.push(file);
    }

    if (!existsColor.colors.includes(color)) {
      existsColor.colors.push(color);
    }

    existsColor.matches++;

    return { ...existsColor.result, cached: true };
  }

  const siblings = getSiblings(color, { config, palette });

  const replaceable = siblings[0]?.delta <= config.delta;

  const info = {
    hex,
    replaceable,
    matches: 1,
    colors: [color],
    siblings,
    files: [file],
  };

  if (isAlpha) {
    info.alpha = {
      opacity: alpha,
      withoutAlpha: toHexWithoutAlpha(hex),
    };
  }

  info.result = getResult(info);

  cache.push(info);

  return info.result;
};

module.exports = {
  toHex,
  toHexWithoutAlpha,
  getResult,
  getColor,
};
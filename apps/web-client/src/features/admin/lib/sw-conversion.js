import { SW_RAW_MAX } from '@appenglish/learning-contracts';

export const SW_SCALED_MAX = 200;
export const SW_SCALED_STEP = 10;

export const swTableLength = (section) => SW_RAW_MAX[section] + 1;

export function toSwInputs(conversion) {
  return { speaking: conversion.speaking.map(String), writing: conversion.writing.map(String) };
}

export function checkSwTable(section, inputs) {
  const length = swTableLength(section);
  const values = inputs.map((raw) => (String(raw).trim() === '' ? NaN : Number(raw)));
  if (values.length !== length) return { error: `Needs ${length} scores.`, bad: [] };
  const bad = values.map((value, index) => (!Number.isInteger(value) || value < 0 || value > SW_SCALED_MAX || value % SW_SCALED_STEP ? index : -1)).filter((index) => index >= 0);
  if (bad.length) return { error: `Every score must be a multiple of ${SW_SCALED_STEP} from 0 to ${SW_SCALED_MAX}.`, bad };
  const down = values.map((value, index) => (index && value < values[index - 1] ? index : -1)).filter((index) => index >= 0);
  if (down.length) return { error: 'Scores must not go down as the raw score goes up.', bad: down };
  return { values, bad: [] };
}

export const sameTable = (a, b) => a.length === b.length && a.every((value, index) => Number(value) === Number(b[index]));

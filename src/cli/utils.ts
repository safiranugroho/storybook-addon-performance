import type { Result, ResultMap } from '../types';
import { ResultsByGroupId, Results } from './types';

/* eslint-disable no-console */
export const debug = (...args: string[]) => console.warn(...args);
export const stdout = (...args: string[]) => console.log(...args);

export const usage = () =>
  debug(`Usage:
sb-perf <directory> [...<directory>]

Example
sb-perf results-directory > output-file.csv
# OR
sb-perf ABTestDirectory OtherDirectory > output-file.csv
`);

const getTaskValue = (result: Result) => {
  if ('averageMs' in result) {
    return result.averageMs;
  }

  if ('value' in result) {
    return Number(result.value);
  }

  return null;
};

export const convertToTaskValueMap = (resultMap: ResultMap) => {
  return Object.values(resultMap).reduce((acc, result) => {
    return { ...acc, [result.taskName]: [getTaskValue(result)] };
  }, {});
};

export const combineTaskResultsByGroupId = (
  results: ResultsByGroupId,
  [groupId, taskValueMap]: [string, Results],
) => {
  Object.entries(taskValueMap).forEach(([taskName, value]) => {
    results[groupId] = {
      ...results[groupId],
      [taskName]:
        results[groupId] && results[groupId][taskName]
          ? results[groupId][taskName].concat(value)
          : value,
    };
  });

  return results;
};

export const median = (numbers: number[]) => {
  const sorted = numbers.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
};

export const performCalculations = (data: Results) => {
  // extracts the number of samples in the dataset
  const numResults = Object.values(data)[0].length;
  return Object.entries(data).map(([key, values]) => ({
    key,
    numResults,
    samples: values.join(','),
    minValue: Math.min(...values),
    maxValue: Math.max(...values),
    meanValue: values.reduce((acc, curr) => acc + curr, 0) / numResults,
    medianValue: median(values),
  }));
};

export type Row = ReturnType<typeof performCalculations>[number];
export type RowByGroupId = { [groupId: string]: Row[] };

/**
 * Turns the row output into a csv
 */
export const printCSV = (rows: Row[]) => {
  // extracts the number of samples the dataset
  const numResults = rows[0].numResults;
  stdout(
    `type,${Array.from({ length: numResults })
      .map((_, i) => `#${i + 1}`)
      .join(',')},min,max,mean,median`,
  );
  rows.forEach(({ key, samples, minValue, maxValue, meanValue, medianValue }) => {
    stdout(`${key},${samples},${minValue},${maxValue},${meanValue},${medianValue}`);
  });
};

const padded = (padding: number) => (str: string | number) => `${str}`.padEnd(padding);
const paddedKey = padded(50);
const paddedValue = padded(20);

export const printCSVSummary = (resultNames: string[], results: RowByGroupId[]) => {
  debug(`${paddedKey('Type')} | ${resultNames.map(paddedValue).join('| ')}`);

  const toPrint = results
    .map((rows) => Object.entries(rows))
    .reduce((acc, rows) => {
      rows.forEach(([groupId, resultSet]) => {
        resultSet.forEach(({ key, medianValue }) => {
          if (acc[groupId] && acc[groupId][key]) {
            acc[groupId][key].push(medianValue);
          } else {
            acc[groupId] = { ...acc[groupId], [key]: [medianValue] };
          }
        });
      });

      return acc;
    }, {} as { [groupId: string]: { [key: string]: number[] } });

  Object.entries(toPrint).forEach(([groupId, resultSet]) => {
    debug('-'.padEnd(50 + 20 * resultNames.length, '-'));
    debug(`${paddedKey(groupId)}`);
    debug('-'.padEnd(50 + 20 * resultNames.length, '-'));

    Object.entries(resultSet).forEach(([key, values]) => {
      debug(`${paddedKey(key)} | ${(values as number[]).map(paddedValue).join('| ')}`);
    });
  });
};

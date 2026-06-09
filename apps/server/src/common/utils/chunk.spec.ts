import { chunkArray } from './chunk';

describe('chunkArray', () => {
  it('should split array into chunks of specified size', () => {
    const result = chunkArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10],
    ]);
  });

  it('should return empty array for empty input', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it('should handle chunk size larger than array', () => {
    expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('should handle chunk size of 1', () => {
    const result = chunkArray(['a', 'b', 'c'], 1);
    expect(result).toEqual([['a'], ['b'], ['c']]);
  });

  it('should handle exactly divisible arrays', () => {
    const result = chunkArray([1, 2, 3, 4], 2);
    expect(result).toEqual([[1, 2], [3, 4]]);
  });

  it('should work with strings', () => {
    const result = chunkArray(['a', 'b', 'c', 'd', 'e'], 2);
    expect(result).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });
});
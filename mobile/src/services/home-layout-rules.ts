export type HomeLayout = {
  moduleColumns: 1 | 2;
  collectionMode: 'compact' | 'rail';
};

export function getHomeLayout(width: number, itemCount: number): HomeLayout {
  return {
    moduleColumns: width >= 768 ? 2 : 1,
    collectionMode: itemCount <= 2 ? 'compact' : 'rail',
  };
}

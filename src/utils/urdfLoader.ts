import URDFLoader, { type URDFRobot } from "urdf-loader";

export async function loadUrdf(url: string): Promise<URDFRobot> {
  const loader = new URDFLoader();

  loader.parseVisual = true;
  loader.parseCollision = false;

  return loader.loadAsync(url);
}

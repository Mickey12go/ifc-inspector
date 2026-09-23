import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";

export class IfcViewer {
  private components = new OBC.Components();
  private world!: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>;
  private fragments!: OBC.FragmentsManager;
  private ifcLoader!: OBC.IfcLoader;
  private initialized = false;
  private modelId: string | null = null;

  async init(container: HTMLElement) {
    if (this.initialized) return;
    const worlds = this.components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
    world.scene = new OBC.SimpleScene(this.components);
    world.renderer = new OBC.SimpleRenderer(this.components, container);
    world.camera = new OBC.OrthoPerspectiveCamera(this.components);
    this.world = world;

    this.components.init();
    world.scene.setup();
    world.camera.controls.setLookAt(12, 12, 12, 0, 0, 0);

    this.components.get(OBC.Grids).create(world);

    this.fragments = this.components.get(OBC.FragmentsManager);
    this.fragments.init(await OBC.FragmentsManager.getWorker());

    this.ifcLoader = this.components.get(OBC.IfcLoader);
    await this.ifcLoader.setup({
      autoSetWasm: false,
      wasm: { path: "/wasm/", absolute: true },
    });

    world.camera.controls.addEventListener("update", () => {
      void this.fragments.core.update(true);
    });

    this.initialized = true;
  }

  async loadModel(data: Uint8Array, name: string): Promise<void> {
    if (!this.initialized) throw new Error("Viewer not initialized");
    await this.unload();

    const model = await this.ifcLoader.load(data, true, name);
    model.useCamera(this.world.camera.three as THREE.PerspectiveCamera);
    this.world.scene.three.add(model.object);
    this.world.meshes.add(model.object as unknown as THREE.Mesh);
    this.modelId = name;

    await this.fragments.core.update(true);
    await this.fitToModel(model);
  }

  private async fitToModel(model: FRAGS.FragmentsModel) {
    const box: THREE.Box3 = model.box;
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.7 || 10;
    const controls = this.world.camera.controls;
    const dir = new THREE.Vector3(1, 0.8, 1).normalize();
    const pos = center.clone().add(dir.multiplyScalar(radius * 2.5));
    await controls.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, true);
    await this.fragments.core.update(true);
  }

  async unload() {
    if (this.modelId) {
      const model = this.fragments.list.get(this.modelId);
      if (model) {
        this.world.scene.three.remove(model.object);
        this.world.meshes.delete(model.object as unknown as THREE.Mesh);
      }
      await this.fragments.core.disposeModel(this.modelId);
      this.modelId = null;
    }
  }

  /** Highlight entities by IFC GUID, dim everything else, and fly the camera to frame them. */
  async highlightGuids(guids: string[]) {
    if (!this.initialized || guids.length === 0) return;
    const map = await this.fragments.guidsToModelIdMap(guids);
    if (Object.keys(map).length === 0) return;
    await this.fragments.resetHighlight();
    // dim all other items so the target stands out
    await this.fragments.highlight({
      color: new THREE.Color(0xffffff),
      renderedFaces: FRAGS.RenderedFaces.ONE,
      opacity: 0.25,
      transparent: true,
    });
    // emphasize the selected items
    await this.fragments.highlight(
      {
        color: new THREE.Color(0xff5252),
        renderedFaces: FRAGS.RenderedFaces.ONE,
        opacity: 1,
        transparent: false,
      },
      map
    );

    const boxes = await this.fragments.getBBoxes(map);
    if (boxes.length > 0) {
      const union = boxes.reduce((acc, b) => acc.union(b), boxes[0].clone());
      const center = union.getCenter(new THREE.Vector3());
      const size = union.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() * 0.5, 2);
      const dir = new THREE.Vector3(1, 0.7, 1).normalize();
      const pos = center.clone().add(dir.multiplyScalar(radius * 3));
      await this.world.camera.controls.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, true);
    }
    await this.fragments.core.update(true);
  }

  async clearHighlight() {
    if (!this.initialized) return;
    await this.fragments.resetHighlight();
    await this.fragments.core.update(true);
  }

  dispose() {
    this.components.dispose();
    this.initialized = false;
  }
}

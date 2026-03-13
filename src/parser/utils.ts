
import type { GameKeeContent } from '../crawler/types.js';

// --- Grid Parser (For Operators) ---

interface GridCell {
  key: string;
  type: string;
  value: string;
  isGlobal?: boolean;
  cellColorClass?: string;
  [key: string]: any;
}

export class GridParser {
  private grid: Map<string, GridCell>;
  private bindings: Record<string, string>;

  constructor(content: GameKeeContent) {
    this.grid = new Map();
    this.bindings = content.entry_data_bind || {};

    if (content.content_json) {
      try {
        const parsed = JSON.parse(content.content_json);
        if (parsed.baseData) {
          const baseData: GridCell[][] = parsed.baseData;
          baseData.forEach(row => {
            row.forEach(cell => {
              if (cell.key) {
                this.grid.set(cell.key, cell);
              }
            });
          });
        }
      } catch (e) {
        console.error(`Failed to parse content_json for ${content.title}`, e);
      }
    }
  }

  getValue(path: string): string | undefined {
    const key = this.bindings[path];
    if (!key) return undefined;

    const cell = this.grid.get(key);
    return cell ? cell.value : undefined;
  }
}

// --- Component Parser (For Weapons, Monsters, Equipment) ---

interface Component {
  key: string;
  type: string;
  data: any;
  [key: string]: any;
}

export class ComponentParser {
  private rootComponents: Component[] = [];

  constructor(content: GameKeeContent) {
    if (content.content_json) {
      try {
        this.rootComponents = JSON.parse(content.content_json);
      } catch (e) {
        console.error(`Failed to parse content_json for ${content.title}`, e);
      }
    }
  }

  findComponent(type: string, predicate?: (data: any) => boolean): Component | undefined {
    return this.searchComponents(this.rootComponents, type, predicate);
  }

  findAllComponents(type: string, predicate?: (data: any) => boolean): Component[] {
    const results: Component[] = [];
    this.collectComponents(this.rootComponents, type, results, predicate);
    return results;
  }

  private searchComponents(components: Component[], type: string, predicate?: (data: any) => boolean): Component | undefined {
    for (const component of components) {
      if (component.type === type) {
        if (!predicate || predicate(component.data)) {
          return component;
        }
      }

      // Recursive search in 'data' if it's an array (like in illustrated-book)
      if (Array.isArray(component.data)) {
        const found = this.searchComponents(component.data, type, predicate);
        if (found) return found;
      }
    }
    return undefined;
  }

  private collectComponents(components: Component[], type: string, results: Component[], predicate?: (data: any) => boolean) {
    for (const component of components) {
      if (component.type === type) {
        if (!predicate || predicate(component.data)) {
          results.push(component);
        }
      }

      if (Array.isArray(component.data)) {
        this.collectComponents(component.data, type, results, predicate);
      }
    }
  }

  // Helper to extract text from "simpleEditor" format
  // {"type":"simpleEditor","data":[{"type":"paragraph","children":[{"text":"Foo"}]}]}
  static extractText(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;

    if (obj.type === 'simpleEditor' && Array.isArray(obj.data)) {
      return obj.data.map((block: any) => {
        if (block.type === 'paragraph' && block.children && Array.isArray(block.children)) {
          return block.children.map((child: any) => child.text || '').join('');
        }
        return '';
      }).join('\n').trim();
    }

    return '';
  }

  // Helper to extract images from "simpleEditor" format
  static extractImages(obj: any): string[] {
    if (!obj) return [];
    const images: string[] = [];

    if (obj.type === 'simpleEditor' && Array.isArray(obj.data)) {
      obj.data.forEach((block: any) => {
        if (block.children && Array.isArray(block.children)) {
          block.children.forEach((child: any) => {
            if (child.type === 'image' && child.src) {
              images.push(child.src);
            }
          });
        }
      });
    }
    return images;
  }

  // Helper to extract mixed content (text and images)
  static extractContent(obj: any): (string | { type: 'image', src: string })[] {
    if (!obj) return [];
    if (typeof obj === 'string') return [obj];

    const content: (string | { type: 'image', src: string })[] = [];

    if (obj.type === 'simpleEditor' && Array.isArray(obj.data)) {
      obj.data.forEach((block: any) => {
        if (block.children && Array.isArray(block.children)) {
          block.children.forEach((child: any) => {
            if (child.text) {
              content.push(child.text);
            } else if (child.type === 'image' && child.src) {
              content.push({ type: 'image', src: child.src });
            }
          });
        }
      });
    }
    return content;
  }
}

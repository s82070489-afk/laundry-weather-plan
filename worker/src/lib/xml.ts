/**
 * 공공데이터포털 XML 응답을 같은 API의 JSON 응답과 같은 모양의 객체로 바꾸는 작은 파서.
 * (Workers 런타임에는 DOMParser가 없고, 응답 구조가 단순해서 직접 파싱한다)
 *
 * - 요소 → 키. 자식 없이 텍스트만 있으면 문자열, 비어 있으면 '' (JSON 응답의 "items": "" 와 같게)
 * - 같은 이름의 형제 요소가 2개 이상이면 배열, 1개면 그대로 (JSON 응답의 item 1건 = 객체와 같게)
 * - 숫자도 문자열로 남는다 (예: locdate "20261003") — 쓰는 쪽에서 String()으로 다룬다
 * - 속성·주석·XML 선언·DOCTYPE은 무시, CDATA와 기본 엔티티(&amp; 등)는 풀어 준다
 * 잘못된 XML이면 throw.
 */
interface XmlNode {
  name: string;
  children: XmlNode[];
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return NAMED_ENTITIES[entity] ?? whole;
  });
}

function skipPast(text: string, from: number, terminator: string): number {
  const end = text.indexOf(terminator, from);
  if (end < 0) throw new Error(`XML: "${terminator}"로 끝나지 않음`);
  return end + terminator.length;
}

function toValue(node: XmlNode): unknown {
  if (node.children.length === 0) return node.text.trim();
  const out: Record<string, unknown> = {};
  for (const child of node.children) {
    const value = toValue(child);
    const prev = out[child.name];
    if (prev === undefined) out[child.name] = value;
    else if (Array.isArray(prev)) prev.push(value);
    else out[child.name] = [prev, value];
  }
  return out;
}

export function parseXml(text: string): Record<string, unknown> {
  const root: XmlNode = { name: '#root', children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;

  while (i < text.length) {
    const top = stack[stack.length - 1];
    const lt = text.indexOf('<', i);
    if (lt < 0) {
      top.text += decodeEntities(text.slice(i));
      break;
    }
    if (lt > i) top.text += decodeEntities(text.slice(i, lt));

    if (text.startsWith('<?', lt)) {
      i = skipPast(text, lt, '?>');
    } else if (text.startsWith('<!--', lt)) {
      i = skipPast(text, lt, '-->');
    } else if (text.startsWith('<![CDATA[', lt)) {
      const end = skipPast(text, lt, ']]>');
      top.text += text.slice(lt + '<![CDATA['.length, end - ']]>'.length);
      i = end;
    } else if (text.startsWith('<!', lt)) {
      i = skipPast(text, lt, '>');
    } else {
      const end = skipPast(text, lt, '>');
      const tag = text.slice(lt + 1, end - 1).trim();
      if (tag.startsWith('/')) {
        const name = tag.slice(1).trim();
        if (stack.length < 2 || top.name !== name) throw new Error(`XML: 짝이 맞지 않는 닫는 태그 </${name}>`);
        stack.pop();
      } else {
        const selfClosing = tag.endsWith('/');
        const name = (selfClosing ? tag.slice(0, -1) : tag).trim().split(/\s/)[0];
        if (!name) throw new Error('XML: 이름 없는 태그');
        const node: XmlNode = { name, children: [], text: '' };
        top.children.push(node);
        if (!selfClosing) stack.push(node);
      }
      i = end;
    }
  }

  if (stack.length !== 1) throw new Error(`XML: 닫히지 않은 요소 <${stack[stack.length - 1].name}>`);
  if (root.children.length !== 1) throw new Error('XML: 최상위 요소가 하나가 아님');
  const [top] = root.children;
  return { [top.name]: toValue(top) };
}

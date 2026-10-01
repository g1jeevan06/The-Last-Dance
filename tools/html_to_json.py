"""Convert this page to a structured, lossless JSON document (standard library only)."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class PageParser(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.nodes = []
        self.stack = []
        self.offsets = [0]
        for line in source.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))

    def append(self, node):
        (self.stack[-1]['children'] if self.stack else self.nodes).append(node)

    def raw_tag(self):
        row, column = self.getpos()
        start = self.offsets[row - 1] + column
        return self.source[start:self.source.index('>', start) + 1]

    def handle_starttag(self, tag, attrs):
        node = {'type': 'element', 'tag': tag,
                'attributes': [{'name': k, 'value': v} for k, v in attrs],
                'openingTag': self.get_starttag_text(), 'children': []}
        self.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1]['tag'] != tag:
            raise ValueError('Unbalanced source HTML at closing tag: ' + tag)
        self.stack.pop()['closingTag'] = self.raw_tag()

    def handle_data(self, data):
        self.append({'type': 'text', 'value': data})

    def handle_comment(self, data):
        self.append({'type': 'comment', 'value': data})

    def handle_decl(self, decl):
        self.append({'type': 'declaration', 'value': decl})

    def handle_entityref(self, name):
        self.append({'type': 'entity', 'value': '&' + name + ';'})

    def handle_charref(self, name):
        self.append({'type': 'entity', 'value': '&#' + name + ';'})


def to_html(node):
    kind = node['type']
    if kind == 'element':
        return node['openingTag'] + ''.join(map(to_html, node['children'])) + node.get('closingTag', '')
    if kind == 'comment':
        return '<!--' + node['value'] + '-->'
    if kind == 'declaration':
        return '<!' + node['value'] + '>'
    return node['value']


def main():
    root = Path(__file__).resolve().parents[1]
    source_bytes = (root / 'index.html').read_bytes()
    source = source_bytes.decode('utf-8')
    parser = PageParser(source)
    parser.feed(source)
    parser.close()
    if parser.stack:
        raise ValueError('Unclosed source HTML elements')
    result = {'format': 'html-document-json', 'version': 1,
              'source': 'index.html', 'encoding': 'utf-8',
              'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
              'document': parser.nodes}
    encoded = json.dumps(result, ensure_ascii=False, indent=2)
    decoded = json.loads(encoded)
    reconstructed = ''.join(map(to_html, decoded['document'])).encode('utf-8')
    if reconstructed != source_bytes:
        raise ValueError('Round-trip validation failed; output was not written')
    (root / 'index.json').write_text(encoded + '\n', encoding='utf-8')
    print('Created index.json. JSON parse and byte-for-byte HTML reconstruction passed.')


if __name__ == '__main__':
    main()

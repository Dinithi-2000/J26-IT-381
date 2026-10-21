"""Inspect the bundled TFLite FlatBuffer without native/runtime dependencies."""
import hashlib
from pathlib import Path
import struct
import sys

path = (Path(sys.argv[1]) if len(sys.argv) > 1 else
        Path(__file__).resolve().parents[1] / 'assets/models/cinnamon_validator.tflite')
data = path.read_bytes()


def number(pos, fmt='I'):
    return struct.unpack_from('<' + fmt, data, pos)[0]


def field(table, index):
    vtable = table - number(table, 'i')
    offset = 4 + index * 2
    if offset >= number(vtable, 'H'):
        return 0
    relative = number(vtable + offset, 'H')
    return table + relative if relative else 0


def indirect(pos):
    return pos + number(pos)


def vector(table, index, tables=False):
    pos = field(table, index)
    if not pos:
        return []
    pos = indirect(pos)
    return [(indirect(pos + 4 + i * 4) if tables else number(pos + 4 + i * 4, 'i'))
            for i in range(number(pos))]


def string(table, index):
    pos = field(table, index)
    if not pos:
        return ''
    pos = indirect(pos)
    return data[pos + 4:pos + 4 + number(pos)].decode()


assert data[4:8] == b'TFL3'
model = number(0)
graph = vector(model, 2, True)[0]
tensors = vector(graph, 0, True)
buffers = vector(model, 4, True)
print('SHA256:', hashlib.sha256(data).hexdigest())
print('Description:', string(model, 3))
for kind, index in [('Input', 1), ('Output', 2)]:
    for slot, i in enumerate(vector(graph, index)):
        tensor = tensors[i]
        print(kind, 'slot=', slot, 'graph_tensor=', i, string(tensor, 3), 'shape=', vector(tensor, 0),
              'type=', number(field(tensor, 1), 'B') if field(tensor, 1) else 0)
for meta in vector(model, 6, True):
    print('Metadata:', string(meta, 0))
opcodes = vector(model, 1, True)
ops = vector(graph, 3, True)
for op in ops[:4] + ops[-2:]:
    code_id = number(field(op, 0)) if field(op, 0) else 0
    code = opcodes[code_id]
    builtin = number(field(code, 3), 'i') if field(code, 3) else number(field(code, 0), 'b')
    print('Operator:', builtin, 'inputs=', vector(op, 1), 'outputs=', vector(op, 2))
    for i in vector(op, 1):
        if i < 0:
            continue
        tensor = tensors[i]
        buf_index = number(field(tensor, 2)) if field(tensor, 2) else 0
        pos = field(buffers[buf_index], 0)
        if pos:
            pos = indirect(pos)
            size = number(pos)
            if 0 < size <= 16:
                print('  Constant:', string(tensor, 3), data[pos+4:pos+4+size].hex(),
                      'float32=', struct.unpack_from('<' + 'f' * (size // 4), data, pos + 4))

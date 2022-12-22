// all length units are in mm
import * from '../manifold/bindings/wasm/manifold';
import THREE from 'three';

// keycap width = 18.10 mm
// clearance    =  1.00 mm
const key_seperation = 18.10 + 1.0;
const column_angle_deg = 15;
const pinky_column_angle_deg = 20;
const row_angle_deg = 5;
const columns = 6;
const rows = 3;
const plate_depth = 4;
const flat_width = 17;

const choc = true; // choc or mx?
// keycap to plate height
const cap_to_plate = choc ? 3.3 : 6.6;
const keycap_height = choc ? 3.5 : 9.6;
const show_keycap = false;

const xz_offsets = [
  [0, 6],
  [0, 6],
  [-7, 0],
  [-12, -2.8],
  [-7, 0],
  [-5, 0]
];

const locking_mech = cube([0.85, 5, 2], true).translate([14/2+0.4, 0, -4]);
const key_body = difference(
  cube([flat_width, flat_width, plate_depth], true).translate([0, 0, -plate_depth]),
  union([
    cube([14.1, 14.1, plate_depth], true).translate([0, 0, -plate_depth]),
    locking_mech,
    locking_mech.rotate([0, 0, 180])
  ])).translate([0, 0, -cap_to_plate]);

const keycap = cube(2, true).warp(v => {
  if (v[2] > 0) {
    v[0] *= 6.2;
    v[1] *= 6.2;
    v[2] = keycap_height;
  } else {
    v[0] *= 9.05;
    v[1] *= 9.05;
    v[2] = 0;
  }
});

const key = show_keycap ? keycap.add(key_body) : key_body;

function range(n: number) {
  return Array(n).fill(0).map((_, i) => i);
}

function get_radius(curve_deg: number): number {
  return key_seperation / Math.sin(curve_deg / 180 * Math.PI);
}

function get_transformation(
  rows: number,
  row_deg: number,
  col_deg: number,
  row_index: number,
  col_index: number,
  x_offset: number,
  z_offset: number): THREE.Matrix4
{
  const column_radius = get_radius(col_deg);
  const row_radius = get_radius(row_deg);
  const col_rad = col_deg / 180 * Math.PI;
  const row_rad = row_deg / 180 * Math.PI;
  function makeTranslation(x: number, y: number, z: number) {
    return (new THREE.Matrix4()).makeTranslation(x, y, z);
  }
  function makeRotation(x: number, y: number, z: number) {
    return (new THREE.Matrix4()).makeRotationFromEuler(new THREE.Euler(x, y, z));
  }

  const matrices = [
    makeTranslation(0, 0, row_radius),
    makeRotation(row_rad * col_index, 0, 0),
    makeTranslation(x_offset, 0, -row_radius + z_offset),

    makeTranslation(0, 0, column_radius),
    makeRotation(0, col_rad * (row_index - (rows - 1)/2), 0),
    makeTranslation(0, 0, -column_radius)
  ];
  return matrices.reduce((previous, current) => previous.multiply(current));
}

function get_column(curve_deg: number, rows: number): Manifold {
  const column_radius = get_radius(curve_deg);
  return union(range(rows).map(
    i => key
      .translate([0, 0, -column_radius])
      .rotate([0, curve_deg * (i - (rows - 1)/2), 0])
  )).translate([0, 0, column_radius])
}

const row_radius = get_radius(row_angle_deg);

const keyboard = union(range(columns).map(
  i => get_column(i < 2 ? pinky_column_angle_deg : column_angle_deg, rows)
    .translate([xz_offsets[i][0], 0, -row_radius + xz_offsets[i][1]])
    .rotate([row_angle_deg*i, 0, 0])
)).translate([0, 0, row_radius]);

function transform_default(row_index: number, col_index: number): THREE.Matrix4 {
  return get_transformation(
    rows, row_angle_deg, col_index < 2 ? pinky_column_angle_deg : column_angle_deg,
    row_index, col_index, xz_offsets[col_index][0], xz_offsets[col_index][1]);
}


const three2manifold = function (vec: THREE.Vector3): Vec3 { return [vec.x, vec.y, vec.z]; };

const fillers = range(columns).flatMap(col_index => range(rows-1).map(row_index => cube([flat_width, flat_width, plate_depth], true)
  .translate([0, 0, -cap_to_plate-plate_depth]).warp(v => {
    const conv2three = (vec: Vec3) => new THREE.Vector3(-vec[0], vec[1], vec[2]);
    const result = three2manifold(conv2three(v).applyMatrix4(transform_default(row_index + (v[0] < 0 ? 1 : 0), col_index)));
    for (const i of [0, 1, 2])
      v[i] = result[i];
  })));

const fillers2 = range(columns-1).flatMap(col_index => range(rows*2-1).map(row_index_2 => cube([flat_width, flat_width, plate_depth], true)
  .translate([0, 0, -cap_to_plate-plate_depth]).warp(v => {
    const conv2three = (vec: Vec3) => new THREE.Vector3((row_index_2 % 2 == 1) ? -vec[0] : vec[0], -vec[1], vec[2]);
    const col = col_index + (v[1] < 0 ? 0 : 1);
    const col2 = col_index + (v[1] > 0 ? 0 : 1);
    if (v[2] < -cap_to_plate-plate_depth && xz_offsets[col][1] - xz_offsets[col2][1] > plate_depth) {
      v[2] -= plate_depth;
    }
    const result = three2manifold(conv2three(v).applyMatrix4(transform_default(
      Math.floor(row_index_2 / 2) + ((row_index_2 % 2 == 1 && v[0] < 0) ? 1 : 0),
      col
    )));
    for (const i of [0, 1, 2])
      v[i] = result[i];
  })));

const result = union([keyboard, ...fillers, ...fillers2]).rotate([-8, 0, 0]);

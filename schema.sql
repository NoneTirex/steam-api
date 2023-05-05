CREATE TABLE IF NOT EXISTS csgo_item
(
    item_id     bigint primary key,
    m           bigint           not null,
    s           bigint           not null,
    d           bigint           not null,

    rarity      smallint         not null,

    origin      smallint         not null,
    quality     smallint         not null,
    paint_index smallint         not null,
    paint_seed  smallint         not null,
    def_index   smallint         not null,

    float_value double precision not null,
    stickers    jsonb,

    last_update timestamp        not null
);
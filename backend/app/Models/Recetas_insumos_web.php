<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Recetas_insumos_web extends Model
{
    protected $table = "recetas_insumos_web";
    public $timestamps = false;

        protected $fillable = [
        'idRecetaInsumo',
        'cantidad_e',
        'cantidad_o',
    ];
}

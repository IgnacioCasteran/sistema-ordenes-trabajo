<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Recetas_lotes_web extends Model
{
    protected $table = "recetas_lotes_web";
    public $timestamps = false;

        protected $fillable = [
        'idRecetaLote',
        'hectareas_e',
        'hectareas_o',
    ];
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Recetas_lotes extends Model
{
    protected $table = "recetas_lotes";
    public $timestamps = false;

    protected $fillable = [
        'idReceta',
        'idRotacionLote',
        'hectareas_estimadas',
        'hectareas',
        'observaciones',
        'error_hectareas',
    ];

}

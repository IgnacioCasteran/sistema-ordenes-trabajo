<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Recetas_parametros extends Model
{
    protected $table = "recetas_parametros";
    public $timestamps = false;

    protected $fillable = [
        'etiqueta',
        'campo_recetas_web',
    ];

}
